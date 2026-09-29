/**
 * Операції журналу поверх сховища. Один і той самий код працює у вебі
 * (IndexedDB) і на телефоні (SQLite) — різниця лише в адаптері.
 *
 * Кожна функція читання знає, від яких таблиць залежить (`fn.tables`), щоб
 * `useQuery` перезапускав саме ті запити, на які вплинула зміна.
 */
import { schoolYearFor, todayISO } from '../domain/dates';
import { now } from '../domain/env';
import { hasObservationData } from '../domain/scoring';
import type { Dataset } from '../domain/aggregate';
import {
  DEFAULT_BELLS,
  DEFAULT_SETTINGS,
  dayId,
  lessonId,
  newId,
  type DayObservation,
  type Holiday,
  type ISODate,
  type Lesson,
  type LessonObservation,
  type Settings,
  type Student,
  type TimetableSlot,
} from '../domain/types';
import { generateLessons, lessonDuration, mergeLessons } from '../schedule/generateLessons';
import { getStore } from './context';
import type { Tbl } from './tables';

type Reader<A extends unknown[], R> = ((...args: A) => Promise<R>) & { tables: readonly Tbl[] };

/** Позначає, від яких таблиць залежить запит. */
function reads<A extends unknown[], R>(tables: readonly Tbl[], fn: (...args: A) => Promise<R>): Reader<A, R> {
  return Object.assign(fn, { tables });
}

// ---------- Налаштування ----------

export function mergeSettings(s?: Partial<Settings>): Settings {
  return {
    id: 'global',
    updatedAt: s?.updatedAt ?? DEFAULT_SETTINGS.updatedAt,
    deletedAt: s?.deletedAt,
    itemOverrides: { ...DEFAULT_SETTINGS.itemOverrides, ...s?.itemOverrides },
    independence: {
      ...DEFAULT_SETTINGS.independence,
      ...s?.independence,
      levels: { ...DEFAULT_SETTINGS.independence.levels, ...s?.independence?.levels },
    },
    insights: { ...DEFAULT_SETTINGS.insights, ...s?.insights },
  };
}

export const getSettings = reads(['settings'], async (): Promise<Settings> =>
  mergeSettings(await getStore().get('settings', 'global')),
);

export async function saveSettings(s: Settings): Promise<void> {
  await getStore().put('settings', mergeSettings(s));
}

// ---------- Діти ----------

export function newStudent(partial: Partial<Student> = {}): Student {
  const year = schoolYearFor(todayISO());
  return {
    id: newId(),
    name: '',
    className: '',
    schoolYear: year.label,
    yearStart: year.start,
    yearEnd: year.end,
    assistantName: '',
    lessonMinutes: 45,
    bells: DEFAULT_BELLS.map((b) => ({ ...b })),
    createdAt: now(),
    updatedAt: now(),
    ...partial,
  };
}

export const listStudents = reads(['students'], async (): Promise<Student[]> => {
  const students = await getStore().all('students');
  return students.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
});

export async function saveStudent(s: Student): Promise<void> {
  await getStore().put('students', s);
}

export async function deleteStudent(id: string): Promise<void> {
  await getStore().deleteByStudent(id);
}

// ---------- Розклад ----------

export const listSlots = reads(['timetable'], (studentId: string): Promise<TimetableSlot[]> =>
  getStore().byStudent('timetable', studentId),
);

/** Записує предмет у клітинку тижневого шаблону; порожній рядок видаляє слот. */
export async function setSlotSubject(
  studentId: string,
  weekday: number,
  lessonNumber: number,
  subject: string,
): Promise<void> {
  const store = getStore();
  await store.tx(async () => {
    const slots = await listSlots(studentId);
    const existing = slots.find(
      (s) => s.weekday === weekday && s.lessonNumber === lessonNumber && !s.validFrom && !s.validTo,
    );
    const value = subject.trim();
    if (!value) {
      if (existing) await store.softDelete('timetable', [existing.id]);
      return;
    }
    await store.put('timetable', {
      ...(existing ?? { id: newId(), studentId, weekday, lessonNumber, updatedAt: '' }),
      subject: value,
    });
  });
}

export const listHolidays = reads(['holidays'], async (studentId: string): Promise<Holiday[]> => {
  const holidays = await getStore().byStudent('holidays', studentId);
  return holidays.sort((a, b) => a.from.localeCompare(b.from));
});

export async function saveHoliday(h: Holiday): Promise<void> {
  await getStore().put('holidays', h);
}

export async function deleteHoliday(id: string): Promise<void> {
  await getStore().softDelete('holidays', [id]);
}

// ---------- Уроки ----------

export const getStoredLessons = reads(['lessons'], (studentId: string, from: ISODate, to: ISODate): Promise<Lesson[]> =>
  getStore().byStudentDateRange('lessons', studentId, from, to),
);

/** Уроки дати/періоду: згенеровані з розкладу + збережені зміни. */
export const getLessonsForRange = reads(
  ['timetable', 'holidays', 'lessons'],
  async (student: Student, from: ISODate, to: ISODate): Promise<Lesson[]> => {
    const [slots, holidays, stored] = await Promise.all([
      listSlots(student.id),
      listHolidays(student.id),
      getStoredLessons(student.id, from, to),
    ]);
    return mergeLessons(generateLessons(student, slots, holidays, from, to), stored);
  },
);

export async function upsertLesson(lesson: Lesson, patch: Partial<Lesson> = {}): Promise<Lesson> {
  const store = getStore();
  return store.tx(async () => {
    const stored = await store.get('lessons', lesson.id);
    return store.put('lessons', { ...lesson, ...stored, ...patch });
  });
}

export async function addManualLesson(
  student: Student,
  date: ISODate,
  lessonNumber: number,
  subject: string,
): Promise<Lesson> {
  return upsertLesson(
    {
      id: lessonId(student.id, date, lessonNumber),
      studentId: student.id,
      date,
      lessonNumber,
      subject,
      source: 'manual',
      updatedAt: '',
    },
    { subject, cancelled: false },
  );
}

export async function setAbsent(lesson: Lesson, absent: boolean, marker = 'н'): Promise<void> {
  await upsertLesson(lesson, { absent, absenceMarker: absent ? marker : undefined });
}

/** Теми, які вже вводили для предмета (для автодоповнення). */
export const topicsForSubject = reads(['lessons'], async (studentId: string, subject: string): Promise<string[]> => {
  const lessons = await getStore().byStudent('lessons', studentId);
  const topics = lessons.filter((l) => l.subject === subject && l.topic?.trim()).map((l) => l.topic!.trim());
  return [...new Set(topics)].sort((a, b) => a.localeCompare(b, 'uk'));
});

// ---------- Спостереження ----------

export const getLessonObs = reads(['lessonObs'], (id: string): Promise<LessonObservation | undefined> =>
  getStore().get('lessonObs', id),
);

type Patch<T> = Partial<T> | ((current: T | undefined) => Partial<T>);
const resolvePatch = <T>(patch: Patch<T>, current: T | undefined) =>
  typeof patch === 'function' ? patch(current) : patch;

/**
 * Зберігає спостереження уроку. Разом з ним зберігається й сам урок (предмет, номер),
 * інакше після зміни розкладу спостереження лишилося б без предмета.
 * Патч-функція отримує поточний запис усередині транзакції — швидкі послідовні
 * натискання не перезаписують одне одного.
 */
export async function saveLessonObs(lesson: Lesson, patch: Patch<LessonObservation>): Promise<LessonObservation> {
  const store = getStore();
  return store.tx(async () => {
    if (!(await store.get('lessons', lesson.id))) await store.put('lessons', lesson);
    const existing = await store.get('lessonObs', lesson.id);
    return store.put('lessonObs', {
      id: lesson.id,
      studentId: lesson.studentId,
      date: lesson.date,
      lessonNumber: lesson.lessonNumber,
      checks: [],
      updatedAt: '',
      ...existing,
      ...resolvePatch(patch, existing),
    });
  });
}

/** Останнє заповнене спостереження перед цим уроком — для «Скопіювати з попереднього уроку». */
export const findPreviousObservation = reads(
  ['lessonObs'],
  async (lesson: Lesson): Promise<LessonObservation | undefined> => {
    const rows = await getStore().byStudentDateRange('lessonObs', lesson.studentId, '0000-00-00', lesson.date);
    return rows
      .filter((o) => (o.date < lesson.date || o.lessonNumber < lesson.lessonNumber) && hasObservationData(o))
      .sort((a, b) => (a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date.localeCompare(b.date)))
      .at(-1);
  },
);

export const listLessonObs = reads(
  ['lessonObs'],
  (studentId: string, from: ISODate, to: ISODate): Promise<LessonObservation[]> =>
    getStore().byStudentDateRange('lessonObs', studentId, from, to),
);

export const getDayObs = reads(['dayObs'], (studentId: string, date: ISODate): Promise<DayObservation | undefined> =>
  getStore().get('dayObs', dayId(studentId, date)),
);

export async function saveDayObs(
  studentId: string,
  date: ISODate,
  patch: Patch<DayObservation>,
): Promise<DayObservation> {
  const store = getStore();
  return store.tx(async () => {
    const existing = await store.get('dayObs', dayId(studentId, date));
    return store.put('dayObs', {
      id: dayId(studentId, date),
      studentId,
      date,
      checks: [],
      updatedAt: '',
      ...existing,
      ...resolvePatch(patch, existing),
    });
  });
}

export const listDayObs = reads(
  ['dayObs'],
  (studentId: string, from: ISODate, to: ISODate): Promise<DayObservation[]> =>
    getStore().byStudentDateRange('dayObs', studentId, from, to),
);

/** Межі наявних даних дитини (перший і останній день зі спостереженнями або підсумками). */
export const dataExtent = reads(
  ['lessonObs', 'dayObs'],
  async (studentId: string): Promise<{ from: ISODate; to: ISODate } | null> => {
    const store = getStore();
    const [obs, days] = await Promise.all([
      store.byStudent('lessonObs', studentId),
      store.byStudent('dayObs', studentId),
    ]);
    const dates = [...obs.map((o) => o.date), ...days.map((d) => d.date)].sort();
    return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
  },
);

/** Усе потрібне для статистики й документів за період. */
export const loadDataset = reads(
  ['timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs', 'settings'],
  async (student: Student, from: ISODate, to: ISODate): Promise<Dataset> => {
    const [lessons, obs, days, settings] = await Promise.all([
      getLessonsForRange(student, from, to),
      listLessonObs(student.id, from, to),
      listDayObs(student.id, from, to),
      getSettings(),
    ]);
    return {
      student,
      from,
      to,
      lessons,
      obsById: new Map(obs.map((o) => [o.id, o])),
      days,
      settings,
      lessonMinutes: (l) => lessonDuration(student, l.lessonNumber),
    };
  },
);
