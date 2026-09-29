import { useEffect, useRef, useState } from 'react';

/**
 * Локальний стан текстового поля з відкладеним збереженням.
 * Зовнішнє значення підхоплюється, лише коли поле не редагують;
 * незбережене значення записується при виході зі сторінки.
 */
export function useDebouncedField<T>(external: T, save: (v: T) => void, delay = 500): [T, (v: T) => void] {
  const [value, setValue] = useState(external);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ value, save });
  latest.current = { value, save };

  useEffect(() => {
    if (!dirty.current) setValue(external);
  }, [external]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) latest.current.save(latest.current.value);
    },
    [],
  );

  const update = (v: T) => {
    setValue(v);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      latest.current.save(v);
      dirty.current = false;
      timer.current = undefined;
    }, delay);
  };
  return [value, update];
}
