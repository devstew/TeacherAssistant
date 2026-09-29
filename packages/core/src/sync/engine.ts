/**
 * Синхронізація з сервером: спершу відправляємо свої зміни, потім забираємо чужі.
 *
 * Правила, на яких усе тримається:
 *  • конфлікт вирішує новіший час зміни, і перевіряє це сервер — інакше
 *    повторна відправка старої офлайн-черги затерла б свіжіший запис;
 *  • курсор завантаження — лічильник сервера, а не годинник пристрою:
 *    телефон із відсталим годинником інакше «зникав» би для інших пристроїв;
 *  • записи, які програли конфлікт, лишаються в журналі конфліктів — мовчазна
 *    втрата денних спостережень неприпустима.
 */
import { now } from '../domain/env';
import type { Store } from '../store/port';
import { TABLES, type Row, type Tbl } from '../store/tables';
import type { Conflict, PushRow, SyncBackend, SyncStatus } from './types';

const CURSOR_KEY = 'sync.cursor';
const LAST_SYNC_KEY = 'sync.lastSyncAt';
const CONFLICTS_KEY = 'sync.conflicts';
const PAGE = 500;
const MAX_CONFLICTS = 50;

export async function listConflicts(store: Store): Promise<Conflict[]> {
  return JSON.parse((await store.meta.get(CONFLICTS_KEY)) ?? '[]') as Conflict[];
}

export async function clearConflicts(store: Store): Promise<void> {
  await store.meta.set(CONFLICTS_KEY, '[]');
}

export interface SyncOptions {
  /** Затримка після локальної зміни перед синхронізацією, мс. */
  debounceMs?: number;
}

export class SyncEngine {
  private status: SyncStatus = { state: 'idle', pending: 0, conflicts: 0 };
  private listeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<SyncStatus> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly store: Store,
    private readonly backend: SyncBackend,
    private readonly options: SyncOptions = {},
  ) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Синхронізувати трохи згодом — щоб серія натискань дала один обмін із сервером. */
  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync().catch(() => {}), this.options.debounceMs ?? 5000);
  }

  /** Один обмін із сервером. Паралельні виклики приєднуються до поточного. */
  async sync(): Promise<SyncStatus> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncStatus> {
    this.update({ state: 'syncing', error: undefined });
    try {
      await this.push();
      await this.pull();
      const lastSyncAt = now();
      await this.store.meta.set(LAST_SYNC_KEY, lastSyncAt);
      return this.update({ state: 'idle', lastSyncAt, ...(await this.counts()) });
    } catch (e) {
      return this.update({ state: 'error', error: e instanceof Error ? e.message : String(e), ...(await this.counts()) });
    }
  }

  // ---------- відправка ----------

  private async push(): Promise<void> {
    const skip = await this.demoStudents();
    for (const table of TABLES) {
      for (;;) {
        const rows = (await this.store.changedSince(table, PAGE)).filter((r) => !this.isDemo(table, r, skip));
        if (!rows.length) break;
        const result = await this.backend.push(rows.map((r) => toRemote(table, r)));
        // Підтверджуємо своїм часом, а не тим, що повернув сервер: Postgres
        // віддає час в іншому форматі, і порівняння рядків не збіглося б.
        const sent = new Map(rows.map((r) => [r.id, r.updatedAt]));
        await this.store.clearDirty(
          table,
          result.accepted.flatMap((a) => (sent.has(a.id) ? [{ id: a.id, updatedAt: sent.get(a.id)! }] : [])),
        );
        const accepted = new Set(result.accepted.map((a) => a.id));
        const rejected = rows.filter((r) => !accepted.has(r.id));
        if (rejected.length) await this.saveConflicts(table, rejected);
        // Відхилені лишаються позначеними, тож нову порцію чекати немає сенсу:
        // їх виправить завантаження з сервера.
        if (rows.length < PAGE || rejected.length === rows.length) break;
      }
    }
  }

  /** Демо-дані на сервер не потрапляють: вони вигадані й важать більше за справжні. */
  private async demoStudents(): Promise<Set<string>> {
    const students = await this.store.all('students', { includeDeleted: true });
    return new Set(students.filter((s) => s.isDemo).map((s) => s.id));
  }

  private isDemo(table: Tbl, row: { id: string; studentId?: string }, demo: Set<string>): boolean {
    return table === 'students' ? demo.has(row.id) : !!row.studentId && demo.has(row.studentId);
  }

  private async saveConflicts(table: Tbl, rows: { id: string; updatedAt: string }[]): Promise<void> {
    const at = now();
    const previous = await listConflicts(this.store);
    const next = [...rows.map((r) => ({ table, id: r.id, localUpdatedAt: r.updatedAt, at })), ...previous].slice(
      0,
      MAX_CONFLICTS,
    );
    await this.store.meta.set(CONFLICTS_KEY, JSON.stringify(next));
  }

  // ---------- завантаження ----------

  private async pull(): Promise<void> {
    for (;;) {
      const cursor = Number((await this.store.meta.get(CURSOR_KEY)) ?? 0);
      const rows = await this.backend.pull(cursor, PAGE);
      if (!rows.length) break;
      // Курсор рухається в тій самій транзакції, що й рядки: перервану
      // синхронізацію можна продовжити без пропусків.
      await this.store.tx(async () => {
        for (const remote of rows) {
          const local = await this.store.get(remote.table, remote.id, { includeDeleted: true });
          if (local && local.updatedAt > remote.updatedAt) continue; // локальна версія новіша — піде наступною відправкою
          await this.store.applyRemote(remote.table, [fromRemote(remote)]);
        }
        const maxSeq = rows.reduce((max, r) => Math.max(max, r.serverSeq), 0);
        await this.store.meta.set(CURSOR_KEY, String(maxSeq));
      });
      if (rows.length < PAGE) break;
    }
  }

  // ---------- службове ----------

  private async counts(): Promise<{ pending: number; conflicts: number }> {
    const skip = await this.demoStudents();
    let pending = 0;
    for (const table of TABLES) {
      pending += (await this.store.changedSince(table, PAGE)).filter((r) => !this.isDemo(table, r, skip)).length;
    }
    return { pending, conflicts: (await listConflicts(this.store)).length };
  }

  private update(patch: Partial<SyncStatus>): SyncStatus {
    this.status = { ...this.status, ...patch };
    for (const fn of [...this.listeners]) fn(this.status);
    return this.status;
  }
}

function toRemote<K extends Tbl>(table: K, row: Row<K>): PushRow {
  const { dirty: _dirty, ...data } = row as Row<K> & { dirty?: 0 | 1 };
  return {
    table,
    id: row.id,
    studentId: (row as { studentId?: string }).studentId,
    date: (row as { date?: string }).date,
    data: data as Record<string, unknown>,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function fromRemote<K extends Tbl>(remote: { table: K; data: Record<string, unknown>; updatedAt: string; deletedAt?: string }): Row<K> {
  return { ...remote.data, updatedAt: remote.updatedAt, deletedAt: remote.deletedAt } as Row<K>;
}
