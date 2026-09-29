/**
 * Перший вхід в акаунт: що робити з даними, які вже є на пристрої.
 *
 * Зливати журнали двох різних асистентів не можна — це чужі дані про дитину,
 * і помилку не виправити. Тому при зміні акаунта застосунок просить спершу
 * зберегти резервну копію, а потім очищає пристрій.
 */
import type { Store } from '../store/port';
import { TABLES, type Row, type Tbl } from '../store/tables';

const OWNER_KEY = 'sync.ownerId';

export type AccountCheck =
  | { kind: 'fresh' }
  | { kind: 'adopt'; rows: number }
  | { kind: 'mismatch'; previousOwner: string };

/** Власні записи пристрою: усе, крім демо-даних (вони не синхронізуються). */
async function ownRows(store: Store): Promise<{ table: Tbl; rows: Row<Tbl>[] }[]> {
  const demo = new Set(
    (await store.all('students', { includeDeleted: true })).filter((s) => s.isDemo).map((s) => s.id),
  );
  const out: { table: Tbl; rows: Row<Tbl>[] }[] = [];
  for (const table of TABLES) {
    const rows = (await store.all(table, { includeDeleted: true })).filter((r) =>
      table === 'students' ? !demo.has(r.id) : !demo.has((r as { studentId?: string }).studentId ?? ''),
    );
    out.push({ table, rows });
  }
  return out;
}

export async function currentOwner(store: Store): Promise<string | undefined> {
  const owner = await store.meta.get(OWNER_KEY);
  return owner || undefined;
}

export async function checkAccount(store: Store, ownerId: string): Promise<AccountCheck> {
  const previousOwner = await currentOwner(store);
  if (previousOwner && previousOwner !== ownerId) return { kind: 'mismatch', previousOwner };
  if (previousOwner === ownerId) return { kind: 'fresh' };
  const rows = (await ownRows(store)).reduce((sum, t) => sum + t.rows.length, 0);
  return rows ? { kind: 'adopt', rows } : { kind: 'fresh' };
}

/** Позначає всі локальні записи як такі, що чекають на відправку, і запам'ятовує власника. */
export async function adoptLocalData(store: Store, ownerId: string): Promise<number> {
  let marked = 0;
  await store.tx(async () => {
    for (const { table, rows } of await ownRows(store)) {
      await store.putKeepingTime(table as 'lessons', rows as Row<'lessons'>[]);
      marked += rows.length;
    }
    await store.meta.set(OWNER_KEY, ownerId);
  });
  return marked;
}

/** Готує пристрій до роботи під іншим акаунтом: усе локальне стирається. */
export async function resetForOwner(store: Store, ownerId: string): Promise<void> {
  await store.clearAll();
  await store.meta.set(OWNER_KEY, ownerId);
}

export async function forgetOwner(store: Store): Promise<void> {
  await store.meta.set(OWNER_KEY, '');
}
