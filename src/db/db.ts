import Dexie, { type Table } from 'dexie';
import type {
  DayObservation,
  Holiday,
  Lesson,
  LessonObservation,
  Settings,
  Student,
  TimetableSlot,
} from '../domain/types';

/**
 * Локальна база в IndexedDB. Дані дитини не залишають пристрій;
 * перенесення між пристроями — через JSON-резервну копію.
 */
export class JournalDB extends Dexie {
  students!: Table<Student, string>;
  timetable!: Table<TimetableSlot, string>;
  holidays!: Table<Holiday, string>;
  lessons!: Table<Lesson, string>;
  lessonObs!: Table<LessonObservation, string>;
  dayObs!: Table<DayObservation, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'assistant-journal') {
    super(name);
    this.version(1).stores({
      students: 'id, createdAt',
      timetable: 'id, studentId',
      holidays: 'id, studentId',
      lessons: 'id, studentId, [studentId+date]',
      lessonObs: 'id, studentId, [studentId+date]',
      dayObs: 'id, studentId, [studentId+date]',
      settings: 'id',
    });
  }
}

export const db = new JournalDB();

/** Таблиці з даними конкретної дитини (для каскадного видалення й резервних копій). */
export const STUDENT_TABLES = ['timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs'] as const;
