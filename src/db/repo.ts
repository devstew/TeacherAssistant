import { db, STUDENT_TABLES } from './db';
import { generateLessons, lessonDuration, mergeLessons } from '../schedule/generateLessons';
import { schoolYearFor, todayISO } from '../domain/dates';
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
import type { StatsInput } from '../domain/aggregate';

const now = () => new Date().toISOString();

// ---------- Налаштування ----------

export function mergeSettings(s?: Partial<Settings>): Settings {
  return {
    id: 'global',
    itemOverrides: { ...DEFAULT_SETTINGS.itemOverrides, ...s?.itemOverrides },
    independence: {
      ...DEFAULT_SETTINGS.independence,
      ...s?.independence,
      levels: { ...DEFAULT_SETTINGS.independence.levels, ...s?.independence?.levels },
    },
    insights: { ...DEFAULT_SETTINGS.insights, ...s?.insights },
  };
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await db.settings.get('global'));
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put(mergeSettings(s));
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
    ...partial,
  };
}

export async function listStudents(): Promise<Student[]> {
  return db.students.orderBy('createdAt').toArray();
}

export async function saveStudent(s: Student): Promise<void> {
  await db.students.put(s);
}

export async function deleteStudent(id: string): Promise<void> {
  await db.transaction('rw', [db.students, ...STUDENT_TABLES.map((t) => db[t])], async () => {
    for (const t of STUDENT_TABLES) await db[t].where('studentId').equals(id).delete();
    await db.students.delete(id);
  });
}

// ---------- Розклад ----------

export async function listSlots(studentId: string): Promise<TimetableSlot[]> {
  return db.timetable.where('studentId').equals(studentId).toArray();
}

/** Записує предмет у клітинку тижневого шаблону; порожній рядок видаляє слот. */
export async function setSlotSubject(
  studentId: string,
  weekday: number,
  lessonNumber: number,
  subject: string,
): Promise<void> {
  const slots = await listSlots(studentId);
  const existing = slots.find(
    (s) => s.weekday === weekday && s.lessonNumber === lessonNumber && !s.validFrom && !s.validTo,
  );
  const value = subject.trim();
  if (!value) {
    if (existing) await db.timetable.delete(existing.id);
    return;
  }
  await db.timetable.put({ ...(existing ?? { id: newId(), studentId, weekday, lessonNumber }), subject: value });
}

export async function listHolidays(studentId: string): Promise<Holiday[]> {
  const hs = await db.holidays.where('studentId').equals(studentId).toArray();
  return hs.sort((a, b) => a.from.localeCompare(b.from));
}

export async function saveHoliday(h: Holiday): Promise<void> {
  await db.holidays.put(h);
}

export async function deleteHoliday(id: string): Promise<void> {
  await db.holidays.delete(id);
}

// ---------- Уроки ----------

export async function getStoredLessons(studentId: string, from: ISODate, to: ISODate): Promise<Lesson[]> {
  return db.lessons.where('[studentId+date]').between([studentId, from], [studentId, to], true, true).toArray();
}

/** Уроки дати/періоду: згенеровані з розкладу + збережені зміни. */
export async function getLessonsForRange(student: Student, from: ISODate, to: ISODate): Promise<Lesson[]> {
  const [slots, holidays, stored] = await Promise.all([
    listSlots(student.id),
    listHolidays(student.id),
    getStoredLessons(student.id, from, to),
  ]);
  return mergeLessons(generateLessons(student, slots, holidays, from, to), stored);
}

export async function upsertLesson(lesson: Lesson, patch: Partial<Lesson> = {}): Promise<Lesson> {
  const stored = await db.lessons.get(lesson.id);
  const next: Lesson = { ...lesson, ...stored, ...patch, updatedAt: now() };
  await db.lessons.put(next);
  return next;
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
    },
    { subject, cancelled: false },
  );
}

export async function setAbsent(lesson: Lesson, absent: boolean, marker = 'н'): Promise<void> {
  await upsertLesson(lesson, { absent, absenceMarker: absent ? marker : undefined });
}

/** Теми, які вже вводили для предмета (для автодоповнення). */
export async function topicsForSubject(studentId: string, subject: string): Promise<string[]> {
  const lessons = await db.lessons.where('studentId').equals(studentId).toArray();
  const topics = lessons.filter((l) => l.subject === subject && l.topic?.trim()).map((l) => l.topic!.trim());
  return [...new Set(topics)].sort((a, b) => a.localeCompare(b, 'uk'));
}

// ---------- Спостереження ----------

export async function getLessonObs(id: string): Promise<LessonObservation | undefined> {
  return db.lessonObs.get(id);
}

type Patch<T> = Partial<T> | ((current: T | undefined) => Partial<T>);
const resolvePatch = <T>(patch: Patch<T>, current: T | undefined) =>
  typeof patch === 'function' ? patch(current) : patch;

/**
 * Зберігає спостереження уроку. Разом з ним зберігається й сам урок (предмет, номер).
 * Патч-функція отримує поточний запис усередині транзакції — швидкі послідовні
 * натискання не перезаписують одне одного.
 */
export async function saveLessonObs(lesson: Lesson, patch: Patch<LessonObservation>): Promise<LessonObservation> {
  return db.transaction('rw', db.lessons, db.lessonObs, async () => {
    if (!(await db.lessons.get(lesson.id))) await db.lessons.put({ ...lesson, updatedAt: now() });
    const existing = await db.lessonObs.get(lesson.id);
    const next: LessonObservation = {
      id: lesson.id,
      studentId: lesson.studentId,
      date: lesson.date,
      lessonNumber: lesson.lessonNumber,
      checks: [],
      ...existing,
      ...resolvePatch(patch, existing),
      updatedAt: now(),
    };
    await db.lessonObs.put(next);
    return next;
  });
}

export async function listLessonObs(studentId: string, from: ISODate, to: ISODate): Promise<LessonObservation[]> {
  return db.lessonObs.where('[studentId+date]').between([studentId, from], [studentId, to], true, true).toArray();
}

export async function getDayObs(studentId: string, date: ISODate): Promise<DayObservation | undefined> {
  return db.dayObs.get(dayId(studentId, date));
}

export async function saveDayObs(
  studentId: string,
  date: ISODate,
  patch: Patch<DayObservation>,
): Promise<DayObservation> {
  return db.transaction('rw', db.dayObs, async () => {
    const existing = await getDayObs(studentId, date);
    const next: DayObservation = {
      id: dayId(studentId, date),
      studentId,
      date,
      checks: [],
      ...existing,
      ...resolvePatch(patch, existing),
      updatedAt: now(),
    };
    await db.dayObs.put(next);
    return next;
  });
}

export async function listDayObs(studentId: string, from: ISODate, to: ISODate): Promise<DayObservation[]> {
  return db.dayObs.where('[studentId+date]').between([studentId, from], [studentId, to], true, true).toArray();
}

/** Межі наявних даних дитини (перший і останній день зі спостереженнями або уроками). */
export async function dataExtent(studentId: string): Promise<{ from: ISODate; to: ISODate } | null> {
  const [obs, days] = await Promise.all([
    db.lessonObs.where('studentId').equals(studentId).toArray(),
    db.dayObs.where('studentId').equals(studentId).toArray(),
  ]);
  const dates = [...obs.map((o) => o.date), ...days.map((d) => d.date)].sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}

export interface Dataset extends StatsInput {
  student: Student;
  from: ISODate;
  to: ISODate;
}

/** Усе потрібне для статистики й експорту за період. */
export async function loadDataset(student: Student, from: ISODate, to: ISODate): Promise<Dataset> {
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
}
