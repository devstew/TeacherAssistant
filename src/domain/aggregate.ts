/**
 * Агрегація спостережень за період: середні індекси, частоти пунктів (% уроків),
 * відвідуваність, розподіл рівня допомоги. Уроки з «н» не входять у знаменник,
 * незаповнені категорії дають null, а не 0.
 */
import {
  LESSON_CATEGORIES,
  SOCIAL,
  type CategoryId,
  type HelpLevel,
} from './formSchema';
import {
  categoryFilled,
  categoryIndex,
  hasDayData,
  hasObservationData,
  mean,
  scoreLesson,
  BEHAVIOR_PARTS,
  LEARNING_PARTS,
  type LessonMetricId,
} from './scoring';
import {
  MONTHS_NOM,
  monthEndISO,
  monthIndex,
  monthKey,
  monthStartISO,
  weekEndISO,
  weekLabel,
  weekStartISO,
} from './dates';
import type { DayObservation, ISODate, Lesson, LessonObservation, Settings } from './types';

export type Grouping = 'week' | 'month';

export type MetricId = LessonMetricId | 'social' | 'learningIndex' | 'behaviorIndex' | 'attendance';

export const METRIC_LABELS: Record<MetricId, string> = {
  learningIndex: 'Індекс навчання',
  behaviorIndex: 'Індекс поведінки',
  learning: 'Навчальна діяльність',
  attention: 'Увага',
  emotion: 'Емоційний стан',
  behavior: 'Поведінка',
  teacher: 'Взаємодія з вчителем',
  social: 'Комунікація',
  independence: 'Самостійність',
  concentration: 'Концентрація',
  attendance: 'Відвідуваність',
};

/** Метрики-індекси 0–100 (без відвідуваності). */
export const CATEGORY_METRICS: MetricId[] = [
  'learning',
  'attention',
  'teacher',
  'independence',
  'behavior',
  'emotion',
  'social',
];

export interface MetricValue {
  value: number | null;
  /** Скільки уроків (днів) дали значення. */
  n: number;
}

export interface ItemFreq {
  count: number;
  n: number;
  pct: number | null;
}

export interface Stats {
  scheduled: number;
  absent: number;
  attended: number;
  observed: number;
  observedDays: number;
  metrics: Record<MetricId, MetricValue>;
  itemFreq: Record<string, ItemFreq>;
  help: Record<HelpLevel, number> & { n: number };
}

export interface Bucket extends Stats {
  key: string;
  label: string;
  start: ISODate;
  end: ISODate;
}

export interface StatsInput {
  /** Заплановані уроки періоду (розклад + збережені), без скасованих. */
  lessons: Lesson[];
  obsById: Map<string, LessonObservation>;
  days: DayObservation[];
  settings: Settings;
  /** Тривалість уроку, хв (для показника концентрації). */
  lessonMinutes: (lesson: Lesson) => number;
}

const LESSON_METRICS: LessonMetricId[] = [
  'learning',
  'attention',
  'emotion',
  'behavior',
  'teacher',
  'independence',
  'concentration',
];

export function computeStats(input: StatsInput): Stats {
  const { settings } = input;
  const lessons = input.lessons.filter((l) => !l.cancelled);
  const attended = lessons.filter((l) => !l.absent);

  const sums = Object.fromEntries(LESSON_METRICS.map((m) => [m, [] as number[]])) as Record<
    LessonMetricId,
    number[]
  >;
  const itemFreq: Record<string, ItemFreq> = {};
  const bump = (id: string, on: boolean) => {
    const f = (itemFreq[id] ??= { count: 0, n: 0, pct: null });
    f.n++;
    if (on) f.count++;
  };
  const help = { none: 0, periodic: 0, partial: 0, full: 0, n: 0 };

  let observed = 0;
  for (const lesson of attended) {
    const obs = input.obsById.get(lesson.id);
    if (!hasObservationData(obs)) continue;
    observed++;
    const scores = scoreLesson(obs, settings, input.lessonMinutes(lesson));
    for (const m of LESSON_METRICS) {
      const v = scores[m];
      if (v != null) sums[m].push(v);
    }
    const checks = new Set(obs.checks);
    for (const cat of LESSON_CATEGORIES) {
      if (!categoryFilled(cat, checks, obs.helpLevel)) continue;
      for (const item of cat.items) bump(item.id, checks.has(item.id));
    }
    if (obs.helpLevel) {
      help[obs.helpLevel]++;
      help.n++;
    }
  }

  const social: number[] = [];
  let observedDays = 0;
  for (const day of input.days) {
    if (!hasDayData(day)) continue;
    observedDays++;
    if (day.checks.length === 0) continue;
    const checks = new Set(day.checks);
    const v = categoryIndex(SOCIAL, checks, settings);
    if (v != null) social.push(v);
    for (const item of SOCIAL.items) bump(item.id, checks.has(item.id));
  }

  for (const f of Object.values(itemFreq)) f.pct = f.n ? (100 * f.count) / f.n : null;

  const mv = (xs: number[]): MetricValue => ({ value: mean(xs), n: xs.length });
  const metrics = {} as Record<MetricId, MetricValue>;
  for (const m of LESSON_METRICS) metrics[m] = mv(sums[m]);
  metrics.social = mv(social);
  metrics.learningIndex = {
    value: mean(LEARNING_PARTS.map((m) => metrics[m].value)),
    n: observed,
  };
  metrics.behaviorIndex = {
    value: mean(BEHAVIOR_PARTS.map((m) => metrics[m].value)),
    n: observed,
  };
  metrics.attendance = {
    value: lessons.length ? (100 * attended.length) / lessons.length : null,
    n: lessons.length,
  };

  return {
    scheduled: lessons.length,
    absent: lessons.length - attended.length,
    attended: attended.length,
    observed,
    observedDays,
    metrics,
    itemFreq,
    help,
  };
}

export function bucketKeyOf(date: ISODate, grouping: Grouping): string {
  return grouping === 'month' ? monthKey(date) : weekStartISO(date);
}

export function bucketMeta(key: string, grouping: Grouping): { label: string; start: ISODate; end: ISODate } {
  if (grouping === 'month') {
    return {
      label: `${MONTHS_NOM[monthIndex(key)]} ${key.slice(0, 4)}`,
      start: monthStartISO(key),
      end: monthEndISO(key),
    };
  }
  return { label: weekLabel(key), start: key, end: weekEndISO(key) };
}

/** Розбиває дані на тижні або місяці. Періоди без уроків і днів не повертаються. */
export function bucketize(input: StatsInput, grouping: Grouping): Bucket[] {
  const lessonsBy = new Map<string, Lesson[]>();
  const daysBy = new Map<string, DayObservation[]>();
  for (const l of input.lessons) {
    const k = bucketKeyOf(l.date, grouping);
    (lessonsBy.get(k) ?? lessonsBy.set(k, []).get(k)!).push(l);
  }
  for (const d of input.days) {
    const k = bucketKeyOf(d.date, grouping);
    (daysBy.get(k) ?? daysBy.set(k, []).get(k)!).push(d);
  }
  const keys = [...new Set([...lessonsBy.keys(), ...daysBy.keys()])].sort();
  return keys.map((key) => ({
    key,
    ...bucketMeta(key, grouping),
    ...computeStats({ ...input, lessons: lessonsBy.get(key) ?? [], days: daysBy.get(key) ?? [] }),
  }));
}

/** Розріз за довільною ознакою уроку (предмет, номер уроку). Дні сюди не входять. */
export function breakdown(input: StatsInput, keyFn: (l: Lesson) => string): { key: string; stats: Stats }[] {
  const groups = new Map<string, Lesson[]>();
  for (const l of input.lessons) {
    const k = keyFn(l);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  return [...groups.entries()].map(([key, lessons]) => ({
    key,
    stats: computeStats({ ...input, lessons, days: [] }),
  }));
}

/** Нахил лінійної регресії (зміна за один період). null, якщо менше 3 точок. */
export function linearSlope(values: readonly (number | null)[]): number | null {
  const pts = values.flatMap((y, x) => (y == null ? [] : [[x, y] as const]));
  if (pts.length < 3) return null;
  const mx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den ? num / den : null;
}

export function delta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  return cur == null || prev == null ? null : cur - prev;
}

/** Категорія, до якої належить метрика (для підписів і фільтрів). */
export const METRIC_CATEGORY: Partial<Record<MetricId, CategoryId>> = {
  learning: 'learning',
  attention: 'attention',
  emotion: 'emotion',
  behavior: 'behavior',
  teacher: 'teacher',
  social: 'social',
  independence: 'assistant',
};
