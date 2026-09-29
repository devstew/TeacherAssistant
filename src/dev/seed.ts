/**
 * Демо-дані для перевірки сценаріїв роботи. Створюються два профілі:
 *  • «поточний» — розклад і спостереження від початку цього навчального року до
 *    сьогодні; останній навчальний день заповнений лише частково, щоб було що
 *    дозаповнити;
 *  • «історія» — вересень–листопад минулого року з помітним покращенням у
 *    листопаді (для дашборду, порівняння місяців і звітів).
 * Генератор детермінований: демо щоразу однакове.
 */
import { db } from '../db/db';
import { deleteStudent } from '../db/repo';
import { generateLessons } from '../schedule/generateLessons';
import {
  ADAPTATION_IDS,
  ATTENTION,
  BEHAVIOR,
  EMOTION,
  LEARNING,
  SOCIAL,
  TEACHER,
  type CategoryDef,
  type HelpLevel,
} from '../domain/formSchema';
import { minISO, schoolYearFor, todayISO } from '../domain/dates';
import {
  dayId,
  lessonId,
  type Bell,
  type DayObservation,
  type Holiday,
  type ISODate,
  type Lesson,
  type LessonObservation,
  type Student,
  type TimetableSlot,
} from '../domain/types';

export const DEMO_CURRENT_ID = 'demo-current';
export const DEMO_HISTORY_ID = 'demo-history';
export const DEMO_IDS = [DEMO_CURRENT_ID, DEMO_HISTORY_ID];

/**
 * Демо-дані вимкнені за замовчуванням, щоб не плутати їх зі справжніми записами.
 * Увімкнути: VITE_ENABLE_DEMO=1 npm run dev (або змінна оточення в Vercel).
 */
export const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO === '1';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BELLS: Bell[] = [
  { lessonNumber: 1, start: '08:30', end: '09:10' },
  { lessonNumber: 2, start: '09:20', end: '10:00' },
  { lessonNumber: 3, start: '10:20', end: '11:00' },
  { lessonNumber: 4, start: '11:20', end: '12:00' },
  { lessonNumber: 5, start: '12:10', end: '12:50' },
  { lessonNumber: 6, start: '13:00', end: '13:40' },
];

const TOPICS: Record<string, string[]> = {
  'Українська мова': ['Звуки і букви', 'Склад. Наголос', 'Слова-назви предметів', 'Слова-назви дій', 'Речення', 'Текст. Заголовок'],
  Математика: ['Нумерація в межах 100', 'Додавання і віднімання в межах 100', 'Таблиця множення на 2', 'Таблиця множення на 3', 'Задачі на дві дії', 'Периметр фігур'],
  Читання: ['Осінні оповідання', 'Казки народів світу', 'Вірші про природу', 'Байки'],
  'Я досліджую світ': ['Сонячна система', 'Осінь у природі', 'Моя родина', 'Правила безпеки'],
  'Англійська мова': ['My family', 'Colours', 'Numbers 1–20', 'My school'],
  Інформатика: ['Безпека в інтернеті', 'Клавіатура', 'Графічний редактор'],
};

const NOTES = [
  'Самостійно виконав два завдання з математики, радів результату.',
  'Труднощі з переходом між уроками, потребував часу, щоб заспокоїтися.',
  'Самостійно переодягнувся на фізкультуру.',
  'Сьогодні вперше попросив допомогу в однокласника.',
  'Швидко втомлювався після 3 уроку — допомогли короткі паузи.',
  'Охоче відповідав біля дошки з опорою на картки.',
  'Конфлікт на перерві через гру, вдалося домовитися з допомогою вчителя.',
  'Рекомендація: частіші короткі паузи на 4–5 уроках.',
  'Акуратно склав речі в портфель без нагадування.',
];

const COMMENTS = [
  'Працював за зразком, самостійно виконав 3 з 5 завдань.',
  'Відволікався на шум у коридорі, повернувся до роботи після нагадування.',
  'Потрібна була картка-підказка з послідовністю дій.',
  'Сам підняв руку й відповів — перший раз цього тижня.',
  'Наприкінці уроку поклав голову на парту, втомився.',
  'Працював у парі з однокласницею, домовились без конфлікту.',
];

const SUBJECT_EFFECT: Record<string, number> = {
  Математика: -0.12,
  'Українська мова': -0.05,
  Мистецтво: 0.12,
  'Музичне мистецтво': 0.1,
  Фізкультура: 0.08,
  'Дизайн і технології': 0.1,
  'Корекційно-розвиткове заняття': 0.15,
};

/** Базові частоти окремих пунктів (множник до ймовірності). */
const ITEM_BIAS: Record<string, number> = {
  'beh.distracted': 1.4,
  'beh.tires': 1.1,
  'beh.stubborn': 0.5,
  'beh.mood_swings': 0.6,
  'learn.no_desire': 0.5,
  'learn.hard_focus': 1.3,
  'tch.needs_personal': 1.4,
  'tch.leading_questions': 1.3,
  'tch.ignores': 0.5,
};

interface DemoProfile {
  id: string;
  name: string;
  className: string;
  humanName: string;
  timetable: Record<number, string[]>;
  year: { label: string; start: ISODate; end: ISODate };
  from: ISODate;
  to: ISODate;
  holidays: { from: ISODate; to: ISODate; title: string }[];
  /** Рівень «успішності» 0…1 за часткою пройденого періоду. */
  level: (t: number) => number;
  fillRate: number;
  /** Останній день заповнити лише до цього уроку (решта — «не заповнено»). */
  leaveLastDayOpen?: number;
  extraLessons?: { fromEnd: number; lessonNumber: number; subject: string }[];
  seed: number;
}

interface DemoData {
  student: Student;
  slots: TimetableSlot[];
  holidays: Holiday[];
  lessons: Lesson[];
  lessonObs: LessonObservation[];
  dayObs: DayObservation[];
}

function buildProfile(p: DemoProfile): DemoData {
  const rnd = mulberry32(p.seed);
  const pick = (prob: number) => rnd() < Math.max(0, Math.min(1, prob));
  const oneOf = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

  const student: Student = {
    id: p.id,
    name: p.name,
    className: p.className,
    schoolYear: p.year.label,
    yearStart: p.year.start,
    yearEnd: p.year.end,
    assistantName: 'Асистент (демо)',
    humanName: p.humanName,
    lessonMinutes: 40,
    bells: BELLS.map((b) => ({ ...b })),
    isDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: `${p.to}T16:00:00.000Z`,
  };

  const slots: TimetableSlot[] = Object.entries(p.timetable).flatMap(([wd, subjects]) =>
    subjects.map((subject, i) => ({
      id: `${p.id}-slot-${wd}-${i + 1}`,
      studentId: p.id,
      weekday: Number(wd),
      lessonNumber: i + 1,
      subject,
      updatedAt: `${p.from}T08:00:00.000Z`,
    })),
  );
  const holidays: Holiday[] = p.holidays.map((h, i) => ({
    id: `${p.id}-hol-${i}`,
    studentId: p.id,
    updatedAt: `${p.from}T08:00:00.000Z`,
    ...h,
  }));

  const generated = generateLessons(student, slots, holidays, p.from, p.to);
  for (const extra of p.extraLessons ?? []) {
    const dates = [...new Set(generated.map((l) => l.date))];
    const date = dates[dates.length - 1 - extra.fromEnd];
    if (date) {
      generated.push({
        id: lessonId(p.id, date, extra.lessonNumber),
        studentId: p.id,
        date,
        lessonNumber: extra.lessonNumber,
        subject: extra.subject,
        source: 'manual',
        updatedAt: `${date}T15:00:00.000Z`,
      });
    }
  }
  generated.sort((a, b) => (a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date.localeCompare(b.date)));

  const schoolDays = [...new Set(generated.map((l) => l.date))];
  const at = (fromEnd: number) => schoolDays[schoolDays.length - 1 - fromEnd];
  // Хвороба (кілька днів поспіль) і день із частковою відсутністю.
  const sickDays = new Set([at(9), at(8)].filter(Boolean));
  const partialDay = at(12);
  const partialLessons = new Set([4, 5]);
  const lastDay = schoolDays[schoolDays.length - 1];

  const lessons: Lesson[] = [];
  const lessonObs: LessonObservation[] = [];
  const topicCursor: Record<string, number> = {};
  const progress = (date: ISODate) => schoolDays.indexOf(date) / Math.max(1, schoolDays.length - 1);

  for (const l of generated) {
    const list = TOPICS[l.subject];
    const topic = list
      ? list[Math.floor((topicCursor[l.subject] = (topicCursor[l.subject] ?? -1) + 1) / 3) % list.length]
      : undefined;
    const absent = sickDays.has(l.date) || (l.date === partialDay && partialLessons.has(l.lessonNumber));
    lessons.push({
      ...l,
      topic,
      absent: absent || undefined,
      absenceMarker: absent ? 'н' : undefined,
      updatedAt: `${l.date}T15:00:00.000Z`,
    });
    const openFrom = l.date === lastDay ? (p.leaveLastDayOpen ?? Infinity) : Infinity;
    if (absent || l.lessonNumber > openFrom || !pick(p.fillRate)) continue;

    const L = Math.max(
      0.05,
      Math.min(
        0.95,
        p.level(progress(l.date)) + (SUBJECT_EFFECT[l.subject] ?? 0) - (l.lessonNumber >= 4 ? 0.1 : 0) + (rnd() - 0.5) * 0.2,
      ),
    );
    const checks: string[] = [];
    for (const cat of [LEARNING, BEHAVIOR, TEACHER] as CategoryDef[]) {
      for (const item of cat.items) {
        const bias = ITEM_BIAS[item.id] ?? 1;
        const lateFatigue = item.id === 'beh.tires' && l.lessonNumber >= 4 ? 0.25 : 0;
        const prob =
          item.polarity === 1 ? (0.12 + 0.62 * L) * bias
          : item.polarity === -1 ? (0.5 - 0.42 * L) * bias + lateFatigue
          : item.id === 'learn.with_assistant' ? 0.75 - 0.45 * L
          : 0.3;
        if (pick(prob)) checks.push(item.id);
      }
    }
    // Групи взаємовиключення: один варіант пари або жодного.
    for (const cat of [ATTENTION, EMOTION]) {
      const groups = [...new Set(cat.items.map((i) => i.group).filter(Boolean))] as string[];
      for (const g of groups) {
        const [pos, neg] = cat.items.filter((i) => i.group === g);
        if (!pick(0.92)) continue;
        checks.push(pick(0.25 + 0.65 * L) ? pos.id : neg.id);
      }
    }
    if (pick(0.35 - 0.3 * L)) checks.push('emo.indifferent');

    const weights: [HelpLevel, number][] = [
      ['full', Math.max(0.03, 0.5 - 0.5 * L)],
      ['partial', 0.3],
      ['periodic', 0.12 + 0.3 * L],
      ['none', 0.02 + 0.25 * L],
    ];
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    const helpLevel = weights.find(([, w]) => (r -= w) < 0)?.[0] ?? 'partial';
    for (const id of ADAPTATION_IDS) if (pick(0.5 - 0.38 * L)) checks.push(id);

    lessonObs.push({
      id: l.id,
      studentId: p.id,
      date: l.date,
      lessonNumber: l.lessonNumber,
      checks,
      helpLevel,
      attentionMinutes: pick(0.6) ? Math.max(3, Math.min(40, Math.round(6 + 24 * L + (rnd() - 0.5) * 8))) : undefined,
      comment: pick(0.15) ? oneOf(COMMENTS) : undefined,
      updatedAt: `${l.date}T15:00:00.000Z`,
    });
  }

  const dayObs: DayObservation[] = [];
  for (const date of schoolDays) {
    // День хвороби й останній (незавершений) день підсумку не мають.
    if (sickDays.has(date) || (date === lastDay && p.leaveLastDayOpen != null) || !pick(0.8)) continue;
    const L = p.level(progress(date)) + (rnd() - 0.5) * 0.2;
    const checks: string[] = [];
    const groupsDone = new Set<string>();
    for (const item of SOCIAL.items) {
      if (item.group) {
        if (groupsDone.has(item.group)) continue;
        groupsDone.add(item.group);
        const pair = SOCIAL.items.filter((i) => i.group === item.group);
        if (pick(0.7)) checks.push(pick(0.25 + 0.6 * L) ? pair[0].id : pair[1].id);
        continue;
      }
      const prob = item.polarity === 1 ? 0.1 + 0.6 * L : item.polarity === -1 ? 0.45 - 0.4 * L : 0.3;
      if (pick(prob)) checks.push(item.id);
    }
    dayObs.push({
      id: dayId(p.id, date),
      studentId: p.id,
      date,
      checks,
      note: pick(0.3) ? oneOf(NOTES) : undefined,
      updatedAt: `${date}T16:00:00.000Z`,
    });
  }

  return { student, slots, holidays, lessons, lessonObs, dayObs };
}

/** Профіль поточного навчального року: дані до сьогодні. */
function currentProfile(): DemoProfile {
  const today = todayISO();
  const year = schoolYearFor(today);
  const y = Number(year.start.slice(0, 4));
  return {
    id: DEMO_CURRENT_ID,
    name: 'Демо: Андрій К.',
    className: '4-А',
    humanName: 'Андрій К.',
    year,
    from: year.start,
    to: minISO(today, year.end),
    timetable: {
      1: ['Українська мова', 'Математика', 'Я досліджую світ', 'Англійська мова', 'Фізкультура'],
      2: ['Читання', 'Математика', 'Українська мова', 'Інформатика', 'Мистецтво'],
      3: ['Українська мова', 'Математика', 'Я досліджую світ', 'Фізкультура'],
      4: ['Читання', 'Англійська мова', 'Математика', 'Я досліджую світ', 'Музичне мистецтво'],
      5: ['Українська мова', 'Математика', 'Фізкультура', 'Дизайн і технології'],
    },
    holidays: [
      { from: `${y}-10-26`, to: `${y}-11-01`, title: 'Осінні канікули' },
      { from: `${y}-12-25`, to: `${y + 1}-01-08`, title: 'Зимові канікули' },
    ],
    level: (t) => 0.34 + 0.22 * t,
    fillRate: 0.9,
    leaveLastDayOpen: 2,
    extraLessons: [{ fromEnd: 1, lessonNumber: 6, subject: 'Корекційно-розвиткове заняття' }],
    seed: 20260901,
  };
}

/** Профіль минулого року: вересень–листопад із покращенням у листопаді. */
function historyProfile(): DemoProfile {
  const y = Number(schoolYearFor(todayISO()).start.slice(0, 4)) - 1;
  return {
    id: DEMO_HISTORY_ID,
    name: 'Демо: Софія М.',
    className: '3-Б',
    humanName: 'Софія М.',
    year: { label: `${y}/${y + 1}`, start: `${y}-09-01`, end: `${y + 1}-05-31` },
    from: `${y}-09-01`,
    to: `${y}-11-30`,
    timetable: {
      1: ['Українська мова', 'Математика', 'Я досліджую світ', 'Фізкультура', 'Мистецтво'],
      2: ['Читання', 'Математика', 'Англійська мова', 'Українська мова', 'Дизайн і технології'],
      3: ['Українська мова', 'Математика', 'Я досліджую світ', 'Фізкультура'],
      4: ['Читання', 'Англійська мова', 'Математика', 'Інформатика', 'Мистецтво'],
      5: ['Українська мова', 'Я досліджую світ', 'Фізкультура', 'Англійська мова'],
    },
    holidays: [{ from: `${y}-10-27`, to: `${y}-11-02`, title: 'Осінні канікули' }],
    // Вересень ≈ 0.30, жовтень ≈ 0.40, листопад ≈ 0.65.
    level: (t) => (t < 0.33 ? 0.3 : t < 0.66 ? 0.4 : 0.55 + 0.15 * ((t - 0.66) / 0.34)),
    fillRate: 0.86,
    seed: 20251115,
  };
}

export interface DemoStudents {
  current: Student;
  history: Student;
}

export async function seedDemo(): Promise<DemoStudents> {
  const data = [buildProfile(currentProfile()), buildProfile(historyProfile())];
  await removeDemo();
  await db.transaction('rw', [db.students, db.timetable, db.holidays, db.lessons, db.lessonObs, db.dayObs], async () => {
    for (const d of data) {
      await db.students.put(d.student);
      await db.timetable.bulkPut(d.slots);
      await db.holidays.bulkPut(d.holidays);
      await db.lessons.bulkPut(d.lessons);
      await db.lessonObs.bulkPut(d.lessonObs);
      await db.dayObs.bulkPut(d.dayObs);
    }
  });
  return { current: data[0].student, history: data[1].student };
}

export async function removeDemo(): Promise<void> {
  for (const id of DEMO_IDS) await deleteStudent(id);
}
