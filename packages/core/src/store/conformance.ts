/**
 * Спільний набір перевірок для будь-якого адаптера сховища. Веб (IndexedDB)
 * і телефон (SQLite) проганяють його однаково — інакше адаптери розійдуться,
 * і різниця виявиться вже у школі.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { onChanged, resetChangeListeners } from './events';
import { Store, type Driver } from './port';
import type { Tbl } from './tables';
import type { Lesson, LessonObservation, Student } from '../domain/types';

const student = (id: string): Student => ({
  id,
  name: `Дитина ${id}`,
  className: '3-А',
  schoolYear: '2026/2027',
  yearStart: '2026-09-01',
  yearEnd: '2027-05-31',
  assistantName: '',
  lessonMinutes: 40,
  bells: [],
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '',
});

const lesson = (studentId: string, date: string, n = 1): Lesson => ({
  id: `${studentId}:${date}:${n}`,
  studentId,
  date,
  lessonNumber: n,
  subject: 'Математика',
  source: 'timetable',
  updatedAt: '',
});

const obs = (l: Lesson, checks: string[] = []): LessonObservation => ({
  id: l.id,
  studentId: l.studentId,
  date: l.date,
  lessonNumber: l.lessonNumber,
  checks,
  updatedAt: '',
});

export function runStoreConformance(name: string, createDriver: () => Promise<Driver>): void {
  describe(`сховище: ${name}`, () => {
    let store: Store;

    beforeEach(async () => {
      resetChangeListeners();
      store = new Store(await createDriver());
      await store.clearAll();
    });

    it('записує з часом зміни й читає назад', async () => {
      const saved = await store.put('students', student('a'));
      expect(saved.updatedAt).not.toBe('');
      expect((await store.get('students', 'a'))?.name).toBe('Дитина a');
      expect(await store.get('students', 'немає')).toBeUndefined();
    });

    it('видалення м\'яке: запис зникає зі списків, але лишається для синхронізації', async () => {
      await store.put('holidays', {
        id: 'h1',
        studentId: 'a',
        from: '2026-10-26',
        to: '2026-11-01',
        title: 'Осінні',
        updatedAt: '',
      });
      await store.softDelete('holidays', ['h1']);

      expect(await store.all('holidays')).toEqual([]);
      expect(await store.get('holidays', 'h1')).toBeUndefined();
      const [tombstone] = await store.all('holidays', { includeDeleted: true });
      expect(tombstone.deletedAt).toBeTruthy();
      expect(tombstone.title).toBe('Осінні');
    });

    it('вибирає записи дитини за періодом', async () => {
      await store.putMany('lessons', [
        lesson('a', '2026-09-01'),
        lesson('a', '2026-09-15'),
        lesson('a', '2026-10-05'),
        lesson('b', '2026-09-10'),
      ]);

      const range = await store.byStudentDateRange('lessons', 'a', '2026-09-01', '2026-09-30');
      expect(range.map((l) => l.date).sort()).toEqual(['2026-09-01', '2026-09-15']);
      expect((await store.byStudent('lessons', 'b')).length).toBe(1);
    });

    it('видаляє дитину з усіма записами й повертає їхні id', async () => {
      await store.put('students', student('a'));
      const l = lesson('a', '2026-09-01');
      await store.put('lessons', l);
      await store.put('lessonObs', obs(l, ['beh.adequate']));

      const removed = await store.deleteByStudent('a');

      expect(removed.lessons).toEqual([l.id]);
      expect(removed.students).toEqual(['a']);
      expect(await store.all('students')).toEqual([]);
      expect(await store.byStudent('lessonObs', 'a')).toEqual([]);
      expect((await store.all('lessonObs', { includeDeleted: true })).length).toBe(1);
    });

    it('позначає локальні зміни, а дані з сервера — ні', async () => {
      const l = lesson('a', '2026-09-01');
      await store.put('lessons', l);
      expect((await store.changedSince('lessons')).map((r) => r.id)).toEqual([l.id]);

      const [dirty] = await store.changedSince('lessons');
      await store.clearDirty('lessons', [{ id: dirty.id, updatedAt: dirty.updatedAt }]);
      expect(await store.changedSince('lessons')).toEqual([]);

      await store.applyRemote('lessons', [{ ...l, subject: 'З сервера', updatedAt: '2026-09-02T10:00:00.000Z' }]);
      expect(await store.changedSince('lessons')).toEqual([]);
      expect((await store.get('lessons', l.id))?.subject).toBe('З сервера');
    });

    it('не знімає позначку з рядка, який змінили після відправки', async () => {
      const l = lesson('a', '2026-09-01');
      const sent = await store.put('lessons', l);
      await store.put('lessons', { ...l, subject: 'Змінили щойно' });

      await store.clearDirty('lessons', [{ id: sent.id, updatedAt: sent.updatedAt }]);

      expect((await store.changedSince('lessons')).length).toBe(1);
    });

    it('транзакції йдуть по черзі: швидкі натискання не затирають одне одного', async () => {
      const l = lesson('a', '2026-09-01');
      await store.put('lessonObs', obs(l));
      const toggle = (item: string) =>
        store.tx(async () => {
          const current = await store.get('lessonObs', l.id);
          await store.put('lessonObs', { ...obs(l), checks: [...(current?.checks ?? []), item] });
        });

      await Promise.all([toggle('beh.adequate'), toggle('beh.tires'), toggle('learn.active')]);

      expect((await store.get('lessonObs', l.id))?.checks.sort()).toEqual([
        'beh.adequate',
        'beh.tires',
        'learn.active',
      ]);
    });

    it('вкладена транзакція не блокує сама себе', async () => {
      const result = await store.tx(async () => {
        await store.put('students', student('a'));
        return store.tx(async () => {
          await store.put('students', student('b'));
          return (await store.all('students')).length;
        });
      });
      expect(result).toBe(2);
    });

    it('повідомляє про зміни один раз на транзакцію', async () => {
      const seen: Tbl[][] = [];
      onChanged((changed) => seen.push([...changed].sort()));

      await store.tx(async () => {
        await store.put('students', student('a'));
        await store.put('lessons', lesson('a', '2026-09-01'));
        await store.put('lessons', lesson('a', '2026-09-02'));
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(seen).toEqual([['lessons', 'students']]);
    });

    it('зберігає службові значення окремо від даних', async () => {
      await store.meta.set('pullCursor', '42');
      expect(await store.meta.get('pullCursor')).toBe('42');
      expect(await store.meta.get('немає')).toBeUndefined();
    });

    it('очищає всі таблиці', async () => {
      await store.put('students', student('a'));
      await store.put('lessons', lesson('a', '2026-09-01'));

      await store.clearAll();

      expect(await store.all('students', { includeDeleted: true })).toEqual([]);
      expect(await store.all('lessons', { includeDeleted: true })).toEqual([]);
    });
  });
}
