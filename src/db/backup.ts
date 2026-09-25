/**
 * Резервна копія у JSON: повне вивантаження бази і відновлення зі злиттям.
 * При злитті спостережень і уроків перемагає новіший запис (updatedAt).
 */
import { z } from 'zod';
import type { Table } from 'dexie';
import { db } from './db';
import { mergeSettings } from './repo';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'дата має бути у форматі YYYY-MM-DD');
const helpLevel = z.enum(['none', 'periodic', 'partial', 'full']);
const polarity = z.union([z.literal(1), z.literal(-1), z.literal(0)]);

const StudentSchema = z.object({
  id: z.string(),
  name: z.string(),
  className: z.string(),
  schoolYear: z.string(),
  yearStart: date,
  yearEnd: date,
  assistantName: z.string(),
  humanName: z.string().optional(),
  lessonMinutes: z.number(),
  bells: z.array(z.object({ lessonNumber: z.number(), start: z.string(), end: z.string() })),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
});

const SlotSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  weekday: z.number().int().min(1).max(7),
  lessonNumber: z.number().int(),
  subject: z.string(),
  validFrom: date.optional(),
  validTo: date.optional(),
});

const HolidaySchema = z.object({ id: z.string(), studentId: z.string(), from: date, to: date, title: z.string() });

const LessonSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  date,
  lessonNumber: z.number().int(),
  subject: z.string(),
  topic: z.string().optional(),
  absent: z.boolean().optional(),
  absenceMarker: z.string().optional(),
  cancelled: z.boolean().optional(),
  source: z.enum(['timetable', 'manual', 'human-file', 'human-api']),
  updatedAt: z.string().optional(),
});

const LessonObsSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  date,
  lessonNumber: z.number().int(),
  checks: z.array(z.string()),
  helpLevel: helpLevel.optional(),
  attentionMinutes: z.number().optional(),
  comment: z.string().optional(),
  updatedAt: z.string(),
});

const DayObsSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  date,
  checks: z.array(z.string()),
  note: z.string().optional(),
  updatedAt: z.string(),
});

const SettingsSchema = z.object({
  id: z.literal('global'),
  itemOverrides: z.record(z.string(), z.object({ polarity: polarity.optional(), weight: z.number().optional() })),
  independence: z.object({
    levelWeight: z.number(),
    adaptWeight: z.number(),
    levels: z.object({ none: z.number(), periodic: z.number(), partial: z.number(), full: z.number() }),
  }),
  insights: z.object({ minLessons: z.number(), minDelta: z.number(), minItemDelta: z.number() }),
});

export const BackupSchema = z.object({
  app: z.literal('assistant-journal'),
  version: z.literal(1),
  exportedAt: z.string(),
  students: z.array(StudentSchema),
  timetable: z.array(SlotSchema),
  holidays: z.array(HolidaySchema),
  lessons: z.array(LessonSchema),
  lessonObs: z.array(LessonObsSchema),
  dayObs: z.array(DayObsSchema),
  settings: z.array(SettingsSchema),
});

export type Backup = z.infer<typeof BackupSchema>;

/** Вивантажує всю базу або дані однієї дитини. */
export async function exportBackup(studentId?: string): Promise<Backup> {
  const by = <T extends { studentId: string }>(rows: T[]) =>
    studentId ? rows.filter((r) => r.studentId === studentId) : rows;
  const [students, timetable, holidays, lessons, lessonObs, dayObs, settings] = await Promise.all([
    db.students.toArray(),
    db.timetable.toArray(),
    db.holidays.toArray(),
    db.lessons.toArray(),
    db.lessonObs.toArray(),
    db.dayObs.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: 'assistant-journal',
    version: 1,
    exportedAt: new Date().toISOString(),
    students: studentId ? students.filter((s) => s.id === studentId) : students,
    timetable: by(timetable),
    holidays: by(holidays),
    lessons: by(lessons),
    lessonObs: by(lessonObs),
    dayObs: by(dayObs),
    settings,
  };
}

/** Перевіряє файл резервної копії. Кидає помилку з людським описом. */
export function parseBackup(json: unknown): Backup {
  const res = BackupSchema.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0];
    const where = issue.path.length ? ` (поле ${issue.path.join('.')})` : '';
    throw new Error(`Файл не схожий на резервну копію журналу: ${issue.message}${where}`);
  }
  return res.data;
}

/** Обирає новіший із двох записів за updatedAt. */
export function newer<T extends { updatedAt?: string }>(existing: T | undefined, incoming: T): boolean {
  if (!existing) return true;
  return (incoming.updatedAt ?? '') >= (existing.updatedAt ?? '');
}

export interface ImportSummary {
  written: number;
  skipped: number;
}

async function putNewer<T extends { id: string; updatedAt?: string }>(
  table: Table<T, string>,
  rows: T[],
): Promise<ImportSummary> {
  const existing = await table.bulkGet(rows.map((r) => r.id));
  const fresh = rows.filter((r, i) => newer(existing[i], r));
  await table.bulkPut(fresh);
  return { written: fresh.length, skipped: rows.length - fresh.length };
}

export async function importBackup(b: Backup): Promise<ImportSummary> {
  const tables = [db.students, db.timetable, db.holidays, db.lessons, db.lessonObs, db.dayObs, db.settings];
  return db.transaction('rw', tables, async () => {
    await db.students.bulkPut(b.students);
    await db.timetable.bulkPut(b.timetable);
    await db.holidays.bulkPut(b.holidays);
    const parts = [
      await putNewer(db.lessons, b.lessons),
      await putNewer(db.lessonObs, b.lessonObs),
      await putNewer(db.dayObs, b.dayObs),
    ];
    if (b.settings[0]) await db.settings.put(mergeSettings(b.settings[0]));
    return {
      written: b.students.length + b.timetable.length + b.holidays.length + parts.reduce((s, p) => s + p.written, 0),
      skipped: parts.reduce((s, p) => s + p.skipped, 0),
    };
  });
}
