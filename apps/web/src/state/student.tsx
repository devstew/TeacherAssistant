import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listStudents } from '../db/repo';
import type { Student } from '@journal/core';

const KEY = 'aj.currentStudentId';

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

interface StudentCtx {
  students: Student[] | undefined;
  student: Student | undefined;
  setStudentId: (id: string) => void;
}

const Ctx = createContext<StudentCtx>({ students: undefined, student: undefined, setStudentId: () => {} });

export function StudentProvider({ children }: { children: ReactNode }) {
  const students = useLiveQuery(() => listStudents(), []);
  const [id, setId] = useState<string | null>(readStored);
  const setStudentId = useCallback((next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // сховище недоступне (приватний режим) — вибір живе до перезавантаження
    }
  }, []);
  const student = students?.find((s) => s.id === id) ?? students?.[0];
  const value = useMemo(() => ({ students, student, setStudentId }), [students, student, setStudentId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStudents = () => useContext(Ctx);

/** Поточна дитина (сторінки рендеряться лише коли вона є). */
export function useStudent(): Student {
  const { student } = useContext(Ctx);
  if (!student) throw new Error('Немає вибраної дитини');
  return student;
}
