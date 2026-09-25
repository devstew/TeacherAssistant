/**
 * Повний аналіз періоду: використовується і дашбордом, і аналітичним звітом,
 * щоб цифри в застосунку та в експортованому документі збігалися.
 */
import {
  breakdown,
  bucketize,
  computeStats,
  linearSlope,
  type Bucket,
  type Grouping,
  type MetricId,
  type Stats,
  type StatsInput,
} from './aggregate';
import { buildInsights, type Insight } from './insights';

export interface Analysis {
  grouping: Grouping;
  buckets: Bucket[];
  weekly: Bucket[];
  overall: Stats;
  bySubject: { key: string; stats: Stats }[];
  byLessonNumber: { key: string; stats: Stats }[];
  insights: Insight[];
  /** Останній період з достатньою кількістю уроків і попередній до нього. */
  current?: Bucket;
  previous?: Bucket;
}

export function analyze(input: StatsInput, grouping: Grouping): Analysis {
  const buckets = bucketize(input, grouping);
  const weekly = grouping === 'week' ? buckets : bucketize(input, 'week');
  const overall = computeStats(input);
  const bySubject = breakdown(input, (l) => l.subject).sort((a, b) => a.key.localeCompare(b.key, 'uk'));
  const byLessonNumber = breakdown(input, (l) => String(l.lessonNumber)).sort((a, b) => Number(a.key) - Number(b.key));
  const insights = buildInsights({ buckets, grouping, overall, bySubject, byLessonNumber, settings: input.settings });
  const qualifying = buckets.filter((b) => b.observed >= input.settings.insights.minLessons);
  return {
    grouping,
    buckets,
    weekly,
    overall,
    bySubject,
    byLessonNumber,
    insights,
    current: qualifying.at(-1),
    previous: qualifying.at(-2),
  };
}

/** Тренд метрики: зміна за тиждень (п.п.) за лінійною регресією по тижнях. */
export function weeklyTrend(a: Analysis, metric: MetricId): number | null {
  return linearSlope(a.weekly.filter((b) => b.observed > 0 || metric === 'attendance').map((b) => b.metrics[metric].value));
}
