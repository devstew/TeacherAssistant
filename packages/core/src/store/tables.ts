import type {
  DayObservation,
  Holiday,
  Lesson,
  LessonObservation,
  Settings,
  Student,
  TimetableSlot,
} from '../domain/types';

export const TABLES = ['students', 'timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs', 'settings'] as const;

export type Tbl = (typeof TABLES)[number];

export interface TableMap {
  students: Student;
  timetable: TimetableSlot;
  holidays: Holiday;
  lessons: Lesson;
  lessonObs: LessonObservation;
  dayObs: DayObservation;
  settings: Settings;
}

export type Row<K extends Tbl> = TableMap[K];

/** Таблиці з даними конкретної дитини (каскадне видалення, резервні копії). */
export const STUDENT_TABLES = ['timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs'] as const satisfies readonly Tbl[];

/** Таблиці, рядки яких мають дату (для вибірок за періодом). */
export const DATED_TABLES = ['lessons', 'lessonObs', 'dayObs'] as const satisfies readonly Tbl[];

/**
 * Службовий прапорець «є локальні зміни, ще не відправлені на сервер».
 * Живе поруч із даними, у доменних типах його немає.
 */
export type Stored<T> = T & { dirty?: 0 | 1 };
