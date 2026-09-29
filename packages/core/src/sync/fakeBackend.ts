import type { PushResult, PushRow, RemoteRecord, SyncBackend } from './types';

/**
 * Сервер у пам'яті з тими самими правилами, що й у SQL: приймає запис, лише
 * якщо він новіший за збережений, і видає зміни за власним лічильником.
 * Потрібен тестам і стане в пригоді під час розробки без мережі.
 */
export class FakeBackend implements SyncBackend {
  private rows = new Map<string, RemoteRecord>();
  private seq = 0;
  /** Імітація обриву зв'язку в тестах. */
  failNextPull = false;
  failNextPush = false;

  async push(rows: PushRow[]): Promise<PushResult> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('мережа недоступна');
    }
    const accepted: PushResult['accepted'] = [];
    for (const row of rows) {
      const key = `${row.table}:${row.id}`;
      const existing = this.rows.get(key);
      if (existing && row.updatedAt <= existing.updatedAt) continue;
      this.rows.set(key, { ...row, serverSeq: ++this.seq });
      accepted.push({ table: row.table, id: row.id, updatedAt: row.updatedAt });
    }
    return { accepted };
  }

  async pull(cursor: number, limit: number): Promise<RemoteRecord[]> {
    if (this.failNextPull) {
      this.failNextPull = false;
      throw new Error('мережа недоступна');
    }
    return [...this.rows.values()]
      .filter((r) => r.serverSeq > cursor)
      .sort((a, b) => a.serverSeq - b.serverSeq)
      .slice(0, limit);
  }

  /** Скільки записів лежить на «сервері» — для перевірок у тестах. */
  get size(): number {
    return this.rows.size;
  }

  snapshot(): RemoteRecord[] {
    return [...this.rows.values()];
  }
}
