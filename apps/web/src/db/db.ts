import Dexie, { type Table } from 'dexie';
import type {
  DayObservation,
  Holiday,
  Lesson,
  LessonObservation,
  Settings,
  Student,
  TimetableSlot,
} from '@journal/core';
import { EPOCH } from '@journal/core';

export { EPOCH };

/**
 * Локальна база в IndexedDB — головне сховище застосунку: він повністю працює без мережі.
 * Копія на сервер іде лише після входу в акаунт (`src/sync`), інакше дані не залишають пристрій.
 */
export class JournalDB extends Dexie {
  students!: Table<Student, string>;
  timetable!: Table<TimetableSlot, string>;
  holidays!: Table<Holiday, string>;
  lessons!: Table<Lesson, string>;
  lessonObs!: Table<LessonObservation, string>;
  dayObs!: Table<DayObservation, string>;
  settings!: Table<Settings, string>;
  /** Службові значення сховища: курсори синхронізації, власник даних. */
  meta!: Table<{ key: string; value: string }, string>;

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
    // Версія 3: службова таблиця для курсорів синхронізації.
    this.version(3).stores({ ...schema, meta: 'key' });
  }
}

export const db = new JournalDB();

/** Таблиці з даними конкретної дитини (для каскадного видалення й резервних копій). */
export const STUDENT_TABLES = ['timetable', 'holidays', 'lessons', 'lessonObs', 'dayObs'] as const;
