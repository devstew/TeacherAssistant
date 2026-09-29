import { now } from '../domain/env';
import type { ISODate } from '../domain/types';
import { batch, emitChanged } from './events';
import { STUDENT_TABLES, TABLES, type Row, type Stored, type Tbl } from './tables';

/**
 * Мінімальний адаптер під конкретне сховище: IndexedDB у браузері,
 * SQLite на телефоні. Уся спільна логіка (час зміни, м'які видалення,
 * події, транзакції) живе в `Store` і для обох платформ однакова.
 */
export interface Driver {
  /** Усі рядки таблиці або лише вказані id (порядок не гарантується). */
  read<K extends Tbl>(table: K, ids?: readonly string[]): Promise<Stored<Row<K>>[]>;
  write<K extends Tbl>(table: K, rows: readonly Stored<Row<K>>[]): Promise<void>;
  clear(): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  /** Рідна транзакція сховища — щоб пакет не лишився записаним наполовину. */
  atomic<T>(fn: () => Promise<T>): Promise<T>;
}

export interface ReadOptions {
  /** Показати й видалені записи («надгробки») — потрібно лише синхронізації. */
  includeDeleted?: boolean;
}

const alive = <T extends { deletedAt?: string }>(rows: T[], opts?: ReadOptions) =>
  opts?.includeDeleted ? rows : rows.filter((r) => !r.deletedAt);

/**
 * Сховище журналу. Кожен запис має час зміни й прапорець «є локальні зміни»,
 * видалення — м'які: без цього не можна зливати дані між пристроями.
 */
export class Store {
  /** Черга транзакцій: два швидкі натискання не перезаписують одне одного. */
  private queue: Promise<unknown> = Promise.resolve();
  private inTx = false;

  constructor(private readonly driver: Driver) {}

  async get<K extends Tbl>(table: K, id: string, opts?: ReadOptions): Promise<Row<K> | undefined> {
    const [row] = await this.driver.read(table, [id]);
    if (!row) return undefined;
    return opts?.includeDeleted || !row.deletedAt ? row : undefined;
  }

  async all<K extends Tbl>(table: K, opts?: ReadOptions): Promise<Row<K>[]> {
    return alive(await this.driver.read(table), opts);
  }

  async byStudent<K extends Tbl>(table: K, studentId: string, opts?: ReadOptions): Promise<Row<K>[]> {
    const rows = await this.all(table, opts);
    return rows.filter((r) => (r as { studentId?: string }).studentId === studentId);
  }

  /**
   * Рядки дитини за період. Фільтр у пам'яті: за навчальний рік це близько
   * тисячі записів, тож окремий індекс не потрібен — і адаптери не розходяться.
   */
  async byStudentDateRange<K extends Tbl>(
    table: K,
    studentId: string,
    from: ISODate,
    to: ISODate,
    opts?: ReadOptions,
  ): Promise<Row<K>[]> {
    const rows = await this.byStudent(table, studentId, opts);
    return rows.filter((r) => {
      const date = (r as { date?: ISODate }).date;
      return date != null && date >= from && date <= to;
    });
  }

  /** Запис із поточним часом зміни — звичайний шлях для інтерфейсу. */
  async put<K extends Tbl>(table: K, row: Row<K>): Promise<Row<K>> {
    const [saved] = await this.putMany(table, [row]);
    return saved;
  }

  async putMany<K extends Tbl>(table: K, rows: readonly Row<K>[]): Promise<Row<K>[]> {
    const stamped = rows.map((r) => ({ ...r, updatedAt: now(), dirty: 1 as const }));
    await this.write(table, stamped);
    return stamped;
  }

  /** Запис із часом, який уже є в рядку: відновлення з резервної копії, демо-дані. */
  async putKeepingTime<K extends Tbl>(table: K, rows: readonly Row<K>[]): Promise<void> {
    await this.write(table, rows.map((r) => ({ ...r, dirty: 1 as const })));
  }

  /** Запис даних, отриманих із сервера: часу не чіпаємо й локальних змін не створюємо. */
  async applyRemote<K extends Tbl>(table: K, rows: readonly Row<K>[]): Promise<void> {
    await this.write(table, rows.map((r) => ({ ...r, dirty: 0 as const })));
  }

  /** М'яке видалення: рядок лишається «надгробком», щоб видалення дійшло до інших пристроїв. */
  async softDelete<K extends Tbl>(table: K, ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    const rows = await this.driver.read(table, ids);
    const stamp = now();
    await this.write(
      table,
      rows.map((r) => ({ ...r, deletedAt: r.deletedAt ?? stamp, updatedAt: stamp, dirty: 1 as const })),
    );
  }

  /** Дитина й усі її записи. Повертає id кожної таблиці — вони потрібні відправці на сервер. */
  async deleteByStudent(studentId: string): Promise<Record<string, string[]>> {
    return this.tx(async () => {
      const removed: Record<string, string[]> = {};
      for (const table of STUDENT_TABLES) {
        const ids = (await this.byStudent(table, studentId)).map((r) => r.id);
        await this.softDelete(table, ids);
        removed[table] = ids;
      }
      await this.softDelete('students', [studentId]);
      removed.students = [studentId];
      return removed;
    });
  }

  // ---------- синхронізація ----------

  /** Локальні зміни, ще не відправлені на сервер. */
  async changedSince<K extends Tbl>(table: K, limit = 500): Promise<Row<K>[]> {
    const rows = await this.driver.read(table);
    return rows.filter((r) => r.dirty === 1).slice(0, limit);
  }

  /** Знімає позначку «змінено локально» з рядків, які сервер прийняв без змін. */
  async clearDirty<K extends Tbl>(table: K, acks: readonly { id: string; updatedAt: string }[]): Promise<void> {
    if (!acks.length) return;
    const byId = new Map(acks.map((a) => [a.id, a.updatedAt]));
    const rows = await this.driver.read(table, [...byId.keys()]);
    const unchanged = rows.filter((r) => r.updatedAt === byId.get(r.id));
    if (unchanged.length) await this.driver.write(table, unchanged.map((r) => ({ ...r, dirty: 0 as const })));
  }

  readonly meta = {
    get: (key: string) => this.driver.getMeta(key),
    set: (key: string, value: string) => this.driver.setMeta(key, value),
  };

  // ---------- службове ----------

  /**
   * Транзакція: операції всередині виконуються по черзі й повідомляють про
   * зміни один раз наприкінці. Вкладений виклик приєднується до поточної —
   * у Dexie вкладення прозоре, а в SQLite ексклюзивні транзакції дають дедлок.
   */
  async tx<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTx) return fn();
    const run = async () => {
      this.inTx = true;
      try {
        return await batch(() => this.driver.atomic(fn));
      } finally {
        this.inTx = false;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async clearAll(): Promise<void> {
    await this.driver.clear();
    emitChanged(TABLES);
  }

  private async write<K extends Tbl>(table: K, rows: readonly Stored<Row<K>>[]): Promise<void> {
    if (!rows.length) return;
    await this.driver.write(table, rows);
    emitChanged([table]);
  }
}
