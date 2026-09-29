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

/** Час для записів, створених до появи синхронізації: вони програють будь-якій правці. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

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
    const schema = {
      students: 'id, createdAt',
      timetable: 'id, studentId',
      holidays: 'id, studentId',
      lessons: 'id, studentId, [studentId+date]',
      lessonObs: 'id, studentId, [studentId+date]',
      dayObs: 'id, studentId, [studentId+date]',
      settings: 'id',
    };
    this.version(1).stores(schema);
    // Версія 2: усі записи мають час останньої зміни — без нього неможливо
    // зливати дані між пристроями (перемагає новіший запис).
    this.version(2)
      .stores(schema)
      .upgrade(async (tx) => {
        for (const name of Object.keys(schema)) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: { updatedAt?: string; createdAt?: string }) => {
              row.updatedAt ||= row.createdAt || EPOCH;
            });
        }
      });
  }
}

export const db = new JournalDB();

/** Таблиці з даними конкретної дитини (для каскадного видалення й резервних копій). */
export const STUDENT_TABLES = ['timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs'] as const;
