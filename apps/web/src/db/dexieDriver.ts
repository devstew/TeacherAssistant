import type { Driver, Row, Stored, Tbl } from '@journal/core';
import { db, type JournalDB } from './db';

/** Адаптер сховища під IndexedDB. Уся спільна логіка живе в ядрі. */
export class DexieDriver implements Driver {
  constructor(private readonly database: JournalDB = db) {}

  private table<K extends Tbl>(name: K) {
    return this.database[name] as unknown as JournalDB['lessons'];
  }

  async read<K extends Tbl>(table: K, ids?: readonly string[]): Promise<Stored<Row<K>>[]> {
    const t = this.table(table);
    const rows = ids ? (await t.bulkGet([...ids])).filter(Boolean) : await t.toArray();
    return rows as unknown as Stored<Row<K>>[];
  }

  async write<K extends Tbl>(table: K, rows: readonly Stored<Row<K>>[]): Promise<void> {
    await this.table(table).bulkPut(rows as never[]);
  }

  async clear(): Promise<void> {
    await Promise.all(this.database.tables.map((t) => t.clear()));
  }

  async getMeta(key: string): Promise<string | undefined> {
    return (await this.database.meta.get(key))?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.database.meta.put({ key, value });
  }

  /**
   * Транзакція охоплює всі таблиці: інакше вкладена операція, що зачепила
   * таблицю поза списком, впала б із помилкою області видимості.
   */
  async atomic<T>(fn: () => Promise<T>): Promise<T> {
    return this.database.transaction('rw', this.database.tables, fn);
  }
}
