import { describe, expect, it } from 'vitest';
import { bucketize, computeStats, linearSlope, type StatsInput } from './aggregate';
import { DEFAULT_SETTINGS, type DayObservation, type Lesson, type LessonObservation } from './types';

const lesson = (date: string, n: number, extra: Partial<Lesson> = {}): Lesson => ({
  id: `s:${date}:${n}`, studentId: 's', date, lessonNumber: n, subject: 'Математика', source: 'timetable', updatedAt: '', ...extra,
});
const obs = (l: Lesson, checks: string[], extra: Partial<LessonObservation> = {}): LessonObservation => ({
  id: l.id, studentId: 's', date: l.date, lessonNumber: l.lessonNumber, checks, updatedAt: '', ...extra,
});

function input(lessons: Lesson[], observations: LessonObservation[], days: DayObservation[] = []): StatsInput {
  return {
    lessons,
    obsById: new Map(observations.map((o) => [o.id, o])),
    days,
    settings: DEFAULT_SETTINGS,
    lessonMinutes: () => 45,
  };
}

describe('computeStats', () => {
  it('уроки з «н» не входять у знаменник, незаповнені — теж', () => {
    const a = lesson('2025-11-03', 1);
    const b = lesson('2025-11-03', 2);
    const c = lesson('2025-11-03', 3, { absent: true });
    const d = lesson('2025-11-03', 4);
    const st = computeStats(
      input([a, b, c, d], [
        obs(a, ['beh.adequate']),
        obs(b, ['beh.distracted', 'beh.adequate']),
        // спостереження на уроці з «н» не рахується
        obs(c, ['beh.distracted']),
      ]),
    );
    expect(st.scheduled).toBe(4);
    expect(st.absent).toBe(1);
    expect(st.attended).toBe(3);
    expect(st.observed).toBe(2);
    expect(st.metrics.attendance.value).toBe(75);
    // «Легко відволікається»: 1 з 2 уроків, де заповнено поведінку
    expect(st.itemFreq['beh.distracted']).toMatchObject({ count: 1, n: 2, pct: 50 });
    expect(st.metrics.behavior.n).toBe(2);
    expect(st.metrics.learning.value).toBeNull();
  });

  it('частота пункту рахується лише серед уроків, де заповнено його категорію', () => {
    const a = lesson('2025-11-03', 1);
    const b = lesson('2025-11-03', 2);
    const st = computeStats(input([a, b], [obs(a, ['beh.tires']), obs(b, ['learn.active'])]));
    expect(st.itemFreq['beh.tires']).toMatchObject({ count: 1, n: 1 });
    expect(st.itemFreq['learn.active']).toMatchObject({ count: 1, n: 1 });
  });

  it('комунікація рахується з днів, зведений індекс поведінки її враховує', () => {
    const a = lesson('2025-11-03', 1);
    const day: DayObservation = { id: 's:2025-11-03', studentId: 's', date: '2025-11-03', checks: ['soc.conflicts'], updatedAt: '' };
    const st = computeStats(input([a], [obs(a, ['beh.adequate', 'emo.positive'])], [day]));
    expect(st.metrics.social.value).toBeCloseTo(50 - 50 / 7);
    expect(st.metrics.behaviorIndex.value).toBeCloseTo((100 + 75 + (50 - 50 / 7)) / 3);
    expect(st.itemFreq['soc.conflicts']).toMatchObject({ count: 1, n: 1 });
  });

  it('розподіл рівня допомоги', () => {
    const a = lesson('2025-11-03', 1);
    const b = lesson('2025-11-03', 2);
    const st = computeStats(input([a, b], [obs(a, [], { helpLevel: 'full' }), obs(b, [], { helpLevel: 'none' })]));
    expect(st.help).toMatchObject({ full: 1, none: 1, n: 2 });
    // «в усьому» без адаптацій = 30, «не потрібна» = 100
    expect(st.metrics.independence.value).toBe(65);
  });
});

describe('bucketize', () => {
  it('групує по місяцях і тижнях', () => {
    const ls = [lesson('2025-10-30', 1), lesson('2025-11-03', 1), lesson('2025-11-10', 1)];
    const months = bucketize(input(ls, []), 'month');
    expect(months.map((b) => b.key)).toEqual(['2025-10', '2025-11']);
    expect(months[1].label).toBe('листопад 2025');
    expect(months[1].scheduled).toBe(2);
    const weeks = bucketize(input(ls, []), 'week');
    expect(weeks.map((b) => b.key)).toEqual(['2025-10-27', '2025-11-03', '2025-11-10']);
    expect(weeks[0].label).toBe('27 жов – 2 лис');
  });
});

describe('linearSlope', () => {
  it('нахил прямої й null для малої кількості точок', () => {
    expect(linearSlope([10, 20, 30])).toBeCloseTo(10);
    expect(linearSlope([10, null, 30, 40])).toBeCloseTo(10);
    expect(linearSlope([10, 20])).toBeNull();
  });
});
