/**
 * Резервна копія у JSON: повне вивантаження бази і відновлення зі злиттям.
 * При злитті спостережень і уроків перемагає новіший запис (updatedAt).
 */
import { z } from 'zod';
import { EPOCH } from '../domain/env';
import { getStore } from './context';
import type { Store } from './port';
import { mergeSettings } from './repo';
import type { Row, Tbl } from './tables';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'дата має бути у форматі YYYY-MM-DD');
const helpLevel = z.enum(['none', 'periodic', 'partial', 'full']);
/** Копії версії 1 не мали часу зміни — підставляємо епоху, щоб вони програвали свіжим записам. */
const synced = { updatedAt: z.string().default(EPOCH), deletedAt: z.string().optional() };
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
  ...synced,
});

const SlotSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  weekday: z.number().int().min(1).max(7),
  lessonNumber: z.number().int(),
  subject: z.string(),
  validFrom: date.optional(),
  validTo: date.optional(),
  ...synced,
});

const HolidaySchema = z.object({
  id: z.string(),
  studentId: z.string(),
  from: date,
  to: date,
  title: z.string(),
  ...synced,
});

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
  ...synced,
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
  ...synced,
});

const DayObsSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  date,
  checks: z.array(z.string()),
  note: z.string().optional(),
  ...synced,
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
  ...synced,
});

export const BackupSchema = z.object({
  app: z.literal('assistant-journal'),
  /** 1 — копії до появи синхронізації, читаються й досі. */
  version: z.union([z.literal(1), z.literal(2)]),
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

/** Вивантажує всю базу або дані однієї дитини. Видалені записи в копію не потрапляють. */
export async function exportBackup(studentId?: string): Promise<Backup> {
  const store = getStore();
  const by = <T extends { studentId: string }>(rows: T[]) =>
    studentId ? rows.filter((r) => r.studentId === studentId) : rows;
  const [students, timetable, holidays, lessons, lessonObs, dayObs, settings] = await Promise.all([
    store.all('students'),
    store.all('timetable'),
    store.all('holidays'),
    store.all('lessons'),
    store.all('lessonObs'),
    store.all('dayObs'),
    store.all('settings'),
  ]);
  return {
    app: 'assistant-journal',
    version: 2,
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

async function putNewer<K extends Tbl>(store: Store, table: K, rows: Row<K>[]): Promise<ImportSummary> {
  const fresh: Row<K>[] = [];
  for (const row of rows) {
    // Порівнюємо і з «надгробками»: видалений запис не має воскресати зі старої копії.
    const existing = await store.get(table, row.id, { includeDeleted: true });
    if (newer(existing, row)) fresh.push(row);
  }
  await store.putKeepingTime(table, fresh);
  return { written: fresh.length, skipped: rows.length - fresh.length };
}

export async function importBackup(b: Backup): Promise<ImportSummary> {
  const store = getStore();
  return store.tx(async () => {
    // Усі таблиці зливаються за часом зміни: інакше стара копія повертала б
    // старий розклад чи профіль на всіх пристроях.
    const parts = [
      await putNewer(store, 'students', b.students),
      await putNewer(store, 'timetable', b.timetable),
      await putNewer(store, 'holidays', b.holidays),
      await putNewer(store, 'lessons', b.lessons),
      await putNewer(store, 'lessonObs', b.lessonObs),
      await putNewer(store, 'dayObs', b.dayObs),
    ];
    const incoming = b.settings[0];
    if (incoming && newer(await store.get('settings', 'global', { includeDeleted: true }), incoming)) {
      await store.putKeepingTime('settings', [mergeSettings(incoming)]);
      parts.push({ written: 1, skipped: 0 });
    }
    return {
      written: parts.reduce((sum, p) => sum + p.written, 0),
      skipped: parts.reduce((sum, p) => sum + p.skipped, 0),
    };
  });
}
