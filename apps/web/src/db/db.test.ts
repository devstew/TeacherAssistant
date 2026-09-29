import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { EPOCH, JournalDB } from './db';

const V1_SCHEMA = {
  students: 'id, createdAt',
  timetable: 'id, studentId',
  holidays: 'id, studentId',
  lessons: 'id, studentId, [studentId+date]',
  lessonObs: 'id, studentId, [studentId+date]',
  dayObs: 'id, studentId, [studentId+date]',
  settings: 'id',
};

describe('міграція бази', () => {
  it('v1 → v2: наявні записи отримують час зміни', async () => {
    const name = `journal-migration-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(V1_SCHEMA);
    await v1.open();
    await v1.table('students').put({ id: 'a', name: 'Стара дитина', createdAt: '2025-09-01T10:00:00.000Z' });
    await v1.table('lessons').put({
      id: 'a:2025-09-01:1',
      studentId: 'a',
      date: '2025-09-01',
      lessonNumber: 1,
      subject: 'Математика',
      source: 'timetable',
    });
    await v1.table('lessonObs').put({
      id: 'a:2025-09-01:1',
      studentId: 'a',
      date: '2025-09-01',
      lessonNumber: 1,
      checks: ['beh.adequate'],
      updatedAt: '2025-09-01T15:00:00.000Z',
    });
    v1.close();

    const v2 = new JournalDB(name);
    await v2.open();
    // Дитина: час береться з дати створення, урок без нього отримує епоху,
    // а вже наявний час спостереження лишається недоторканим.
    expect((await v2.students.get('a'))?.updatedAt).toBe('2025-09-01T10:00:00.000Z');
    expect((await v2.lessons.get('a:2025-09-01:1'))?.updatedAt).toBe(EPOCH);
    expect((await v2.lessonObs.get('a:2025-09-01:1'))?.updatedAt).toBe('2025-09-01T15:00:00.000Z');
    expect((await v2.students.get('a'))?.name).toBe('Стара дитина');
    v2.close();
  });
});
