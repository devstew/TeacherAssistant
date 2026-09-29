import type { Driver } from './port';
import { TABLES, type Row, type Stored, type Tbl } from './tables';

/** Сховище в пам'яті: тести ядра й спільний набір перевірок для адаптерів. */
export class MemoryDriver implements Driver {
  private tables = new Map<Tbl, Map<string, unknown>>(TABLES.map((t) => [t, new Map()]));
  private metaRows = new Map<string, string>();

  async read<K extends Tbl>(table: K, ids?: readonly string[]): Promise<Stored<Row<K>>[]> {
    const rows = this.tables.get(table)!;
    const pick = ids ? ids.map((id) => rows.get(id)) : [...rows.values()];
    return pick.filter(Boolean).map((r) => structuredClone(r) as Stored<Row<K>>);
  }

  async write<K extends Tbl>(table: K, rows: readonly Stored<Row<K>>[]): Promise<void> {
    const target = this.tables.get(table)!;
    for (const row of rows) target.set(row.id, structuredClone(row));
  }

  async clear(): Promise<void> {
    for (const rows of this.tables.values()) rows.clear();
    this.metaRows.clear();
  }

  async getMeta(key: string): Promise<string | undefined> {
    return this.metaRows.get(key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.metaRows.set(key, value);
  }

  async atomic<T>(fn: () => Promise<T>): Promise<T> {
    // Знімок на випадок збою: у пам'яті відкотити дешево.
    const snapshot = new Map([...this.tables].map(([t, rows]) => [t, new Map(rows)]));
    try {
      return await fn();
    } catch (e) {
      this.tables = snapshot;
      throw e;
    }
  }
}
