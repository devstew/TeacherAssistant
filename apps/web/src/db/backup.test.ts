import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getStore, setStore, Store } from '@journal/core';
import { JournalDB, EPOCH } from './db';
import { DexieDriver } from './dexieDriver';
import { exportBackup, importBackup, parseBackup } from './backup';
import { getLessonsForRange, listSlots, loadDataset, saveLessonObs, setAbsent, setSlotSubject } from '@journal/core';
import { DEMO_HISTORY_ID, seedDemo } from '../dev/seed';
import { applyAbsences } from '../integrations/human/apply';
import { bucketize } from '@journal/core';

setStore(new Store(new DexieDriver(new JournalDB(`backup-test-${Math.random().toString(36).slice(2)}`))));

async function clearAll() {
  await getStore().clearAll();
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
    expect((await getStore().get('lessonObs', lesson.id))?.comment).toBe('новіше');
  });

  it('стара копія не повертає старий розклад (злиття за часом зміни)', async () => {
    const { history } = await seedDemo();
    const old = await exportBackup();
    await setSlotSubject(history.id, 1, 1, 'Новий предмет');

    await importBackup(old);

    const slot = (await listSlots(history.id)).find((x) => x.weekday === 1 && x.lessonNumber === 1);
    expect(slot?.subject).toBe('Новий предмет');
  });

  it('читає копію версії 1: записам без часу зміни ставиться епоха', async () => {
    const { history } = await seedDemo();
    const v1 = JSON.parse(JSON.stringify(await exportBackup())) as Record<string, unknown>;
    v1.version = 1;
    for (const table of ['students', 'timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs', 'settings']) {
      for (const row of v1[table] as Record<string, unknown>[]) delete row.updatedAt;
    }
    const parsed = parseBackup(v1);
    expect(parsed.students[0].updatedAt).toBe(EPOCH);

    await setSlotSubject(history.id, 1, 1, 'Локальна зміна');
    await importBackup(parsed);

    const slot = (await listSlots(history.id)).find((x) => x.weekday === 1 && x.lessonNumber === 1);
    expect(slot?.subject).toBe('Локальна зміна');
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
