import { beforeEach, describe, expect, it } from 'vitest';
import { setEnv } from '../domain/env';
import { MemoryDriver } from '../store/memory';
import { Store } from '../store/port';
import type { Lesson, LessonObservation, Student } from '../domain/types';
import { SyncEngine, listConflicts } from './engine';
import { adoptLocalData, checkAccount } from './account';
import { FakeBackend } from './fakeBackend';

// Керований годинник: тести мають самі вирішувати, чия правка новіша.
let clock = Date.parse('2026-09-01T08:00:00.000Z');
setEnv({ now: () => new Date(clock++).toISOString() });
const laterBy = (ms: number) => {
  clock += ms;
};

const student = (id = 'a'): Student => ({
  id,
  name: 'Андрій К.',
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

const lesson = (date = '2026-09-01'): Lesson => ({
  id: `a:${date}:1`,
  studentId: 'a',
  date,
  lessonNumber: 1,
  subject: 'Математика',
  source: 'timetable',
  updatedAt: '',
});

const obs = (checks: string[]): LessonObservation => ({
  id: 'a:2026-09-01:1',
  studentId: 'a',
  date: '2026-09-01',
  lessonNumber: 1,
  checks,
  updatedAt: '',
});

describe('синхронізація', () => {
  let server: FakeBackend;
  let phone: Store;
  let laptop: Store;
  let phoneSync: SyncEngine;
  let laptopSync: SyncEngine;

  beforeEach(() => {
    server = new FakeBackend();
    phone = new Store(new MemoryDriver());
    laptop = new Store(new MemoryDriver());
    phoneSync = new SyncEngine(phone, server);
    laptopSync = new SyncEngine(laptop, server);
  });

  it('зміни з одного пристрою доходять до іншого', async () => {
    await phone.put('students', student());
    await phone.put('lessonObs', obs(['beh.adequate']));

    await phoneSync.sync();
    await laptopSync.sync();

    expect((await laptop.get('students', 'a'))?.name).toBe('Андрій К.');
    expect((await laptop.get('lessonObs', 'a:2026-09-01:1'))?.checks).toEqual(['beh.adequate']);
    expect(phoneSync.getStatus()).toMatchObject({ state: 'idle', pending: 0, conflicts: 0 });
  });

  it('видалення доходить до іншого пристрою', async () => {
    await phone.put('lessons', lesson());
    await phoneSync.sync();
    await laptopSync.sync();

    await phone.softDelete('lessons', ['a:2026-09-01:1']);
    await phoneSync.sync();
    await laptopSync.sync();

    expect(await laptop.get('lessons', 'a:2026-09-01:1')).toBeUndefined();
    expect((await laptop.all('lessons', { includeDeleted: true })).length).toBe(1);
  });

  it('повторна синхронізація нічого не дублює', async () => {
    await phone.put('lessons', lesson());
    await phoneSync.sync();
    await phoneSync.sync();
    await laptopSync.sync();
    await laptopSync.sync();

    expect(server.size).toBe(1);
    expect((await laptop.all('lessons')).length).toBe(1);
    expect(laptopSync.getStatus().pending).toBe(0);
  });

  it('офлайн-правки обох пристроїв: перемагає новіша, програшна лишається в журналі', async () => {
    await phone.put('lessonObs', obs([]));
    await phoneSync.sync();
    await laptopSync.sync();

    // Обидва правлять той самий урок, не бачачи одне одного.
    await phone.put('lessonObs', obs(['beh.adequate', 'learn.active']));
    laterBy(60_000);
    await laptop.put('lessonObs', obs(['beh.tires']));

    await laptopSync.sync(); // новіша правка йде першою
    await phoneSync.sync(); // стара не має затерти новішу

    expect(server.snapshot().find((r) => r.table === 'lessonObs')?.data.checks).toEqual(['beh.tires']);
    const conflicts = await listConflicts(phone);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ table: 'lessonObs', id: 'a:2026-09-01:1' });
    expect(phoneSync.getStatus().conflicts).toBe(1);
    // Наступне завантаження приводить телефон до версії сервера.
    expect((await phone.get('lessonObs', 'a:2026-09-01:1'))?.checks).toEqual(['beh.tires']);
    expect(phoneSync.getStatus().pending).toBe(0);
  });

  it('обрив зв\'язку: наступна синхронізація продовжує з того самого місця', async () => {
    await phone.put('students', student());
    await phone.put('lessons', lesson('2026-09-01'));
    await phone.put('lessons', lesson('2026-09-02'));
    await phoneSync.sync();

    server.failNextPull = true;
    const failed = await laptopSync.sync();
    expect(failed.state).toBe('error');
    expect(await laptop.all('lessons')).toEqual([]);

    const ok = await laptopSync.sync();
    expect(ok.state).toBe('idle');
    expect((await laptop.all('lessons')).length).toBe(2);
    expect((await laptop.get('students', 'a'))?.name).toBe('Андрій К.');
  });

  it('локальні зміни лишаються позначеними, поки сервер недоступний', async () => {
    await phone.put('lessons', lesson());
    server.failNextPush = true;

    const failed = await phoneSync.sync();

    expect(failed.state).toBe('error');
    expect(failed.pending).toBe(1);
    expect(server.size).toBe(0);

    const ok = await phoneSync.sync();
    expect(ok).toMatchObject({ state: 'idle', pending: 0 });
    expect(server.size).toBe(1);
  });

  it('демо-дані не потрапляють на сервер', async () => {
    await phone.put('students', { ...student('demo-current'), isDemo: true });
    await phone.put('lessons', { ...lesson(), id: 'demo:1', studentId: 'demo-current' });
    await phone.put('students', student('a'));

    await phoneSync.sync();

    expect(server.snapshot().map((r) => r.id)).toEqual(['a']);
    expect(phoneSync.getStatus().pending).toBe(0);
  });
});

describe('перехід даних в акаунт', () => {
  it('локальні дані приймаються в новий акаунт, а чужий акаунт відхиляється', async () => {
    const server = new FakeBackend();
    const store = new Store(new MemoryDriver());
    await store.put('students', student());
    await store.put('lessons', lesson());
    await store.applyRemote('students', [{ ...student('demo-current'), isDemo: true }]);

    expect(await checkAccount(store, 'user-1')).toEqual({ kind: 'adopt', rows: 2 });
    const marked = await adoptLocalData(store, 'user-1');
    expect(marked).toBe(2);

    await new SyncEngine(store, server).sync();
    expect(server.snapshot().map((r) => r.id).sort()).toEqual(['a', 'a:2026-09-01:1']);

    expect(await checkAccount(store, 'user-1')).toEqual({ kind: 'fresh' });
    expect(await checkAccount(store, 'user-2')).toEqual({ kind: 'mismatch', previousOwner: 'user-1' });
  });
});
