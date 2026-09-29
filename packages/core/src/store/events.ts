import type { Tbl } from './tables';

/**
 * Події про зміни в сховищі. Замість того щоб кожен екран сам стежив за базою,
 * сховище повідомляє, які таблиці змінилися, а хук `useQuery` перезапускає
 * запити, що від них залежать.
 *
 * Події збираються за мікрозадачу: пакетний запис 500 рядків дає одне
 * повідомлення, а не 500 перемальовок.
 */
export type ChangeListener = (changed: ReadonlySet<Tbl>) => void;

const listeners = new Set<ChangeListener>();
let pending: Set<Tbl> | null = null;
let depth = 0;

function flush(): void {
  const batched = pending;
  pending = null;
  if (!batched?.size) return;
  for (const listener of [...listeners]) listener(batched);
}

export function emitChanged(tables: Iterable<Tbl>): void {
  const first = !pending;
  pending ??= new Set();
  for (const t of tables) pending.add(t);
  if (first && depth === 0) queueMicrotask(flush);
}

export function onChanged(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Притримує повідомлення до кінця операції: синхронізація, імпорт, демо-дані. */
export async function batch<T>(fn: () => Promise<T>): Promise<T> {
  depth++;
  try {
    return await fn();
  } finally {
    depth--;
    if (depth === 0) flush();
  }
}

/** Лише для тестів: прибрати всіх підписників. */
export function resetChangeListeners(): void {
  listeners.clear();
  pending = null;
  depth = 0;
}
