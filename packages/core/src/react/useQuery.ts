import { useEffect, useMemo, useRef, useState } from 'react';
import { onChanged } from '../store/events';
import type { Tbl } from '../store/tables';

/**
 * Запит до сховища, який сам перезапускається, коли змінюються потрібні таблиці.
 * Поки даних немає — повертає `undefined` (екрани показують «Завантаження…»).
 *
 * Чому не просто `useEffect`: запити асинхронні, тож пізніший результат не має
 * перезаписувати новіший, а функція має бути свіжою — інакше вона працюватиме
 * зі старими пропсами.
 */
export function useQuery<T>(run: () => Promise<T>, tables: readonly Tbl[], deps: readonly unknown[]): T | undefined {
  const [state, setState] = useState<{ value: T | undefined }>({ value: undefined });
  const latest = useRef(run);
  latest.current = run;

  const key = useMemo(() => JSON.stringify(deps.map((d) => (typeof d === 'object' && d ? depKey(d) : d))), deps);
  const watched = useMemo(() => new Set(tables), [tables.join(',')]);

  useEffect(() => {
    let alive = true;
    let seq = 0;
    const exec = () => {
      const mine = ++seq;
      latest.current().then(
        (value) => {
          if (alive && mine === seq) setState({ value });
        },
        (error) => {
          if (!alive || mine !== seq) return;
          console.error('Запит до сховища не виконався', error);
          setState({ value: undefined });
        },
      );
    };
    exec();
    const off = onChanged((changed) => {
      for (const t of changed) if (watched.has(t)) return exec();
    });
    return () => {
      alive = false;
      off();
    };
    // key і watched уже враховують deps і таблиці
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, watched]);

  return state.value;
}

/** Об'єкти в залежностях порівнюємо за id, а не за посиланням. */
function depKey(d: object): unknown {
  return 'id' in d ? (d as { id: unknown }).id : d;
}

/**
 * Скорочення для функцій репозиторію: таблиці й залежності беруться з самої
 * функції та її аргументів — `useRepo(getLessonsForRange, student, from, to)`.
 */
export function useRepo<A extends unknown[], R>(
  fn: ((...args: A) => Promise<R>) & { tables: readonly Tbl[] },
  ...args: A
): R | undefined {
  return useQuery(() => fn(...args), fn.tables, args);
}
