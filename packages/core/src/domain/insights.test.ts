import { describe, expect, it } from 'vitest';
import { bucketize, breakdown, computeStats, type StatsInput } from './aggregate';
import { buildInsights } from './insights';
import { DEFAULT_SETTINGS, type Lesson, type LessonObservation } from './types';

/** Місяць із n уроків; перші bad уроків — «погані», решта — «добрі». */
function month(key: string, n: number, bad: number) {
  const lessons: Lesson[] = [];
  const obs: LessonObservation[] = [];
  for (let i = 0; i < n; i++) {
    const date = `${key}-${String(3 + (i % 20)).padStart(2, '0')}`;
    const l: Lesson = { id: `s:${date}:${i}`, studentId: 's', date, lessonNumber: (i % 5) + 1, subject: i % 2 ? 'Математика' : 'Мистецтво', source: 'timetable', updatedAt: '' };
    lessons.push(l);
    const isBad = i < bad;
    obs.push({
      id: l.id, studentId: 's', date, lessonNumber: l.lessonNumber, updatedAt: '',
      checks: isBad ? ['beh.distracted', 'beh.impulsive', 'learn.hard_focus'] : ['beh.adequate', 'learn.active', 'learn.interest'],
      helpLevel: isBad ? 'full' : 'periodic',
    });
  }
  return { lessons, obs };
}

function build(parts: ReturnType<typeof month>[]) {
  const input: StatsInput = {
    lessons: parts.flatMap((p) => p.lessons),
    obsById: new Map(parts.flatMap((p) => p.obs).map((o) => [o.id, o])),
    days: [],
    settings: DEFAULT_SETTINGS,
    lessonMinutes: () => 45,
  };
  return buildInsights({
    buckets: bucketize(input, 'month'),
    grouping: 'month',
    overall: computeStats(input),
    bySubject: breakdown(input, (l) => l.subject),
    byLessonNumber: breakdown(input, (l) => String(l.lessonNumber)),
    settings: DEFAULT_SETTINGS,
  });
}

describe('buildInsights', () => {
  it('«у листопаді кращі показники», коли обидва індекси зросли понад поріг', () => {
    const texts = build([month('2025-10', 20, 12), month('2025-11', 20, 4)]).map((i) => i.text);
    expect(texts[0]).toMatch(/^У листопаді дитина показала кращі показники, ніж у жовтні: навчання \d+ \(\+\d+ п\.п\.\), поведінка \d+ \(\+\d+ п\.п\.\)\.$/);
    expect(texts).toContain('Покращення: «Активно працює на уроці» — 80% уроків (було 40%).');
    expect(texts.some((t) => t.includes('«в усьому» потрібна на 20% уроків (було 60%)'))).toBe(true);
  });

  it('нижчі показники — тон «bad»', () => {
    const res = build([month('2025-10', 20, 4), month('2025-11', 20, 12)]);
    expect(res[0].tone).toBe('bad');
    expect(res[0].text).toMatch(/^У листопаді дитина показала нижчі показники/);
  });

  it('замало уроків — лише інформаційне повідомлення про нестачу даних', () => {
    const res = build([month('2025-10', 5, 3), month('2025-11', 5, 1)]);
    expect(res[0]).toMatchObject({ tone: 'info' });
    expect(res[0].text).toMatch(/Замало даних/);
    expect(res.some((i) => i.text.includes('кращі показники'))).toBe(false);
  });

  it('зміна менша за поріг — стабільні показники', () => {
    const res = build([month('2025-10', 20, 5), month('2025-11', 20, 5)]);
    expect(res[0].text).toMatch(/^У листопаді показники стабільні/);
  });
});
