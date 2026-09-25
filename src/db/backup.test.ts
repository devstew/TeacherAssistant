import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';
import { getLessonsForRange, loadDataset, saveLessonObs, setAbsent } from './repo';
import { DEMO_HISTORY_ID, seedDemo } from '../dev/seed';
import { applyAbsences } from '../integrations/human/apply';
import { bucketize } from '../domain/aggregate';

async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

describe('резервна копія', () => {
  beforeEach(clearAll);

  it('зберігається й відновлюється без втрат (через JSON)', async () => {
    await seedDemo();
    const before = await exportBackup();
    expect(before.lessonObs.length).toBeGreaterThan(100);

    const json = JSON.parse(JSON.stringify(before));
    await clearAll();
    const summary = await importBackup(parseBackup(json));
    expect(summary.skipped).toBe(0);

    const after = await exportBackup();
    const strip = (b: typeof before) => ({ ...b, exportedAt: '' });
    expect(strip(after)).toEqual(strip(before));
  });

  it('при злитті перемагає новіший запис', async () => {
    const { history } = await seedDemo();
    const [lesson] = await getLessonsForRange(history, '2025-11-03', '2025-11-03');
    const old = await exportBackup();
    await saveLessonObs(lesson, { checks: ['beh.adequate'], comment: 'новіше' });
    await importBackup(old);
    expect((await db.lessonObs.get(lesson.id))?.comment).toBe('новіше');
  });

  it('відхиляє чужий файл з поясненням', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(/не схожий на резервну копію/);
  });
});

describe('демо-дані та імпорт відсутностей', () => {
  beforeEach(clearAll);

  it('у демо листопад кращий за жовтень', async () => {
    const { history } = await seedDemo();
    const ds = await loadDataset(history, '2025-09-01', '2025-11-30');
    const months = bucketize(ds, 'month');
    const [, oct, nov] = months;
    expect(months.map((m) => m.key)).toEqual(['2025-09', '2025-10', '2025-11']);
    expect(nov.metrics.behaviorIndex.value!).toBeGreaterThan(oct.metrics.behaviorIndex.value! + 5);
    expect(nov.metrics.learningIndex.value!).toBeGreaterThan(oct.metrics.learningIndex.value! + 5);
  });

  it('позначає «н» на всіх уроках дня або лише на вказаному', async () => {
    const { history: student } = await seedDemo();
    const res = await applyAbsences(student, [
      { date: '2025-11-04', marker: 'н' },
      { date: '2025-11-05', marker: 'н', lessonNumber: 2 },
      { date: '2025-11-06', marker: '2', count: 2 },
      { date: '2025-11-08', marker: 'н' }, // субота — уроків немає
    ]);
    const tue = await getLessonsForRange(student, '2025-11-04', '2025-11-04');
    const wed = await getLessonsForRange(student, '2025-11-05', '2025-11-05');
    expect(tue.every((l) => l.absent)).toBe(true);
    expect(wed.filter((l) => l.absent).map((l) => l.lessonNumber)).toEqual([2]);
    expect(res.partialDays).toEqual([{ date: '2025-11-06', count: 2, total: 5 }]);
    expect(res.noLessons).toEqual(['2025-11-08']);
    expect(res.marked).toBe(tue.length + 1);

    await setAbsent(wed[1], false);
    const wed2 = await getLessonsForRange(student, '2025-11-05', '2025-11-05');
    expect(wed2.some((l) => l.absent)).toBe(false);
    expect(student.id).toBe(DEMO_HISTORY_ID);
  });
});
