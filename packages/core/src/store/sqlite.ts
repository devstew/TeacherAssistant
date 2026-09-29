/**
 * Адаптер сховища під SQLite — база мобільного застосунку.
 *
 * Усі сім видів записів живуть в одній таблиці: журнал читається цілими
 * таблицями (фільтри працюють у пам'яті, це тисяча рядків на рік), тож окремі
 * таблиці дали б лише більше схеми й більше місць для розбіжності з вебом.
 *
 * Драйвер не знає, звідки взялося з'єднання: на телефоні це `expo-sqlite`,
 * у тестах — вбудований у Node `node:sqlite`. Так спільний набір перевірок
 * проганяється по тому самому SQL, що поїде на пристрій.
 */
import type { Driver } from './port';
import type { Row, Stored, Tbl } from './tables';

export type SqlValue = string | number | null;

export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Рідна транзакція: пакет не має лишитися записаним наполовину. */
  tx<T>(fn: () => Promise<T>): Promise<T>;
}

export const SCHEMA = `
create table if not exists records (
  tbl        text not null,
  id         text not null,
  student_id text,
  date       text,
  updated_at text not null,
  deleted_at text,
  dirty      integer not null default 0,
  data       text not null,
  primary key (tbl, id)
);
create index if not exists records_student on records (tbl, student_id, date);
create index if not exists records_dirty on records (tbl, dirty);
create table if not exists meta (key text primary key, value text not null);
`;

/** Межа параметрів у запиті: у старих складаннях SQLite це 999. */
const CHUNK = 100;

const chunks = <T>(xs: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
};

interface StoredRecord {
  data: string;
  dirty: number;
}

export class SqliteDriver implements Driver {
  constructor(private readonly conn: SqlConnection) {}

  static async create(conn: SqlConnection): Promise<SqliteDriver> {
    await conn.exec(SCHEMA);
    return new SqliteDriver(conn);
  }

  async read<K extends Tbl>(table: K, ids?: readonly string[]): Promise<Stored<Row<K>>[]> {
    if (ids && !ids.length) return [];
    const found: Stored<Row<K>>[] = [];
    const queries = ids
      ? chunks(ids, CHUNK).map((part) => ({
          sql: `select data, dirty from records where tbl = ? and id in (${part.map(() => '?').join(',')})`,
          params: [table, ...part] as SqlValue[],
        }))
      : [{ sql: 'select data, dirty from records where tbl = ?', params: [table] as SqlValue[] }];
    for (const q of queries) {
      for (const r of await this.conn.all<StoredRecord>(q.sql, q.params)) {
        found.push({ ...(JSON.parse(r.data) as Row<K>), dirty: r.dirty === 1 ? 1 : 0 });
      }
    }
    return found;
  }

  async write<K extends Tbl>(table: K, rows: readonly Stored<Row<K>>[]): Promise<void> {
    for (const part of chunks(rows, CHUNK)) {
      const values = part.map(() => '(?,?,?,?,?,?,?,?)').join(',');
      const params: SqlValue[] = [];
      for (const row of part) {
        const { dirty = 0, ...data } = row;
        params.push(
          table,
          row.id,
          (row as { studentId?: string }).studentId ?? null,
          (row as { date?: string }).date ?? null,
          row.updatedAt,
          row.deletedAt ?? null,
          dirty,
          JSON.stringify(data),
        );
      }
      await this.conn.run(
        `insert into records (tbl, id, student_id, date, updated_at, deleted_at, dirty, data) values ${values}
         on conflict (tbl, id) do update set
           student_id = excluded.student_id,
           date = excluded.date,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at,
           dirty = excluded.dirty,
           data = excluded.data`,
        params,
      );
    }
  }

  async clear(): Promise<void> {
    await this.conn.run('delete from records');
    await this.conn.run('delete from meta');
  }

  async getMeta(key: string): Promise<string | undefined> {
    const [row] = await this.conn.all<{ value: string }>('select value from meta where key = ?', [key]);
    return row?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.conn.run(
      'insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
      [key, value],
    );
  }

  async atomic<T>(fn: () => Promise<T>): Promise<T> {
    return this.conn.tx(fn);
  }
}
