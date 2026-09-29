/**
 * Розрахунок відносних показників одного уроку чи дня.
 *
 * Індекс категорії = 50 + 50 × (P/Pmax − N/Nmax), де P і N — сума ваг позначених
 * позитивних і негативних пунктів, Pmax і Nmax — сума ваг усіх позитивних
 * і негативних пунктів категорії. 50 — нейтрально, 100 — усі позитивні без
 * жодного негативного. Якщо не позначено жодного оцінного пункту — null.
 */
import {
  ADAPTATION_IDS,
  ASSISTANT,
  ATTENTION,
  BEHAVIOR,
  EMOTION,
  LEARNING,
  SOCIAL,
  TEACHER,
  type CategoryDef,
  type ItemDef,
  type Polarity,
} from './formSchema';
import type { DayObservation, LessonObservation, Settings } from './types';

export interface ResolvedItem {
  id: string;
  polarity: Polarity;
  weight: number;
}

export function resolveItem(item: ItemDef, settings: Settings): ResolvedItem {
  const o = settings.itemOverrides[item.id];
  return {
    id: item.id,
    polarity: o?.polarity ?? item.polarity,
    weight: o?.weight ?? item.weight ?? 1,
  };
}

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));

export function mean(xs: readonly (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const x of xs) {
    if (x == null || Number.isNaN(x)) continue;
    sum += x;
    n++;
  }
  return n ? sum / n : null;
}

export function categoryIndex(cat: CategoryDef, checks: ReadonlySet<string>, settings: Settings): number | null {
  let p = 0;
  let n = 0;
  let pMax = 0;
  let nMax = 0;
  for (const def of cat.items) {
    const it = resolveItem(def, settings);
    if (it.polarity === 0 || it.weight <= 0) continue;
    const on = checks.has(it.id);
    if (it.polarity === 1) {
      pMax += it.weight;
      if (on) p += it.weight;
    } else {
      nMax += it.weight;
      if (on) n += it.weight;
    }
  }
  if (p === 0 && n === 0) return null;
  const pos = pMax > 0 ? p / pMax : 0;
  const neg = nMax > 0 ? n / nMax : 0;
  return clamp(50 + 50 * (pos - neg));
}

/** Чи заповнена категорія на уроці (позначено хоч один пункт). */
export function categoryFilled(cat: CategoryDef, checks: ReadonlySet<string>, helpLevel?: string): boolean {
  if (cat.id === ASSISTANT.id && helpLevel) return true;
  return cat.items.some((i) => checks.has(i.id));
}

/**
 * Самостійність = 100 × (1 − підтримка), де
 * підтримка = (wL × рівень допомоги + wA × частка застосованих адаптацій) / (wL + wA).
 */
export function independenceIndex(
  obs: Pick<LessonObservation, 'helpLevel' | 'checks'>,
  settings: Settings,
): number | null {
  if (!obs.helpLevel) return null;
  const { levelWeight, adaptWeight, levels } = settings.independence;
  const level = levels[obs.helpLevel] ?? 0;
  const checks = new Set(obs.checks);
  const share = ADAPTATION_IDS.filter((id) => checks.has(id)).length / ADAPTATION_IDS.length;
  const total = levelWeight + adaptWeight;
  const support = total > 0 ? (levelWeight * level + adaptWeight * share) / total : level;
  return clamp(100 * (1 - support));
}

export function concentrationIndex(
  obs: Pick<LessonObservation, 'attentionMinutes'>,
  lessonMinutes: number,
): number | null {
  if (obs.attentionMinutes == null || !(lessonMinutes > 0)) return null;
  return clamp((100 * obs.attentionMinutes) / lessonMinutes);
}

export function hasObservationData(obs?: LessonObservation): obs is LessonObservation {
  return !!obs && (obs.checks.length > 0 || !!obs.helpLevel || obs.attentionMinutes != null);
}

export function hasDayData(day?: DayObservation): day is DayObservation {
  return !!day && (day.checks.length > 0 || !!day.note?.trim());
}

export type LessonMetricId = 'learning' | 'attention' | 'emotion' | 'behavior' | 'teacher' | 'independence' | 'concentration';

export interface LessonScores extends Record<LessonMetricId, number | null> {
  /** Середнє з навчальної діяльності, уваги, взаємодії з вчителем і самостійності. */
  learningComposite: number | null;
  /** Середнє з поведінки та емоційного стану (комунікацію оцінюють раз на день). */
  behaviorComposite: number | null;
}

/** Складові зведених індексів (на рівні періоду). */
export const LEARNING_PARTS = ['learning', 'attention', 'teacher', 'independence'] as const;
export const BEHAVIOR_PARTS = ['behavior', 'emotion', 'social'] as const;

export function scoreLesson(obs: LessonObservation, settings: Settings, lessonMinutes: number): LessonScores {
  const checks = new Set(obs.checks);
  const s = {
    learning: categoryIndex(LEARNING, checks, settings),
    attention: categoryIndex(ATTENTION, checks, settings),
    emotion: categoryIndex(EMOTION, checks, settings),
    behavior: categoryIndex(BEHAVIOR, checks, settings),
    teacher: categoryIndex(TEACHER, checks, settings),
    independence: independenceIndex(obs, settings),
    concentration: concentrationIndex(obs, lessonMinutes),
  };
  return {
    ...s,
    learningComposite: mean([s.learning, s.attention, s.teacher, s.independence]),
    behaviorComposite: mean([s.behavior, s.emotion]),
  };
}

export function scoreDay(day: DayObservation, settings: Settings): { social: number | null } {
  return { social: categoryIndex(SOCIAL, new Set(day.checks), settings) };
}
