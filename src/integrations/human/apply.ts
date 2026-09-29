/** Запис підтверджених даних з Human у локальну базу. */
import { db } from '../../db/db';
import { getLessonsForRange } from '../../db/repo';
import { lessonId, type Lesson, type Student } from '../../domain/types';
import type { AbsenceRecord } from './provider';
import type { TopicAssignment } from './fileImport/topicsXlsx';

export interface AbsenceApplyResult {
  /** Скільки уроків позначено «н». */
  marked: number;
  /** Дні, де у файлі вказано кількість пропущених уроків, менша за кількість уроків у розкладі. */
  partialDays: { date: string; count: number; total: number }[];
  /** Дати без уроків у розкладі (канікули або розклад не заповнено). */
  noLessons: string[];
}

export async function applyAbsences(student: Student, records: AbsenceRecord[]): Promise<AbsenceApplyResult> {
  const res: AbsenceApplyResult = { marked: 0, partialDays: [], noLessons: [] };
  const now = new Date().toISOString();
  const toPut: Lesson[] = [];
  for (const r of records) {
    const lessons = await getLessonsForRange(student, r.date, r.date);
    const mark = (l: Lesson) =>
      toPut.push({ ...l, absent: true, absenceMarker: r.marker, updatedAt: now });
    if (r.lessonNumber) {
      const l = lessons.find((x) => x.lessonNumber === r.lessonNumber);
      mark(
        l ?? {
          id: lessonId(student.id, r.date, r.lessonNumber),
          studentId: student.id,
          date: r.date,
          lessonNumber: r.lessonNumber,
          subject: r.subject ?? '—',
          source: 'human-file',
          updatedAt: now,
        },
      );
      continue;
    }
    if (!lessons.length) {
      res.noLessons.push(r.date);
      continue;
    }
    if (r.count != null && r.count < lessons.length) {
      res.partialDays.push({ date: r.date, count: r.count, total: lessons.length });
      continue;
    }
    lessons.forEach(mark);
  }
  await db.lessons.bulkPut(toPut);
  res.marked = toPut.length;
  return res;
}

export async function applyTopics(assignments: TopicAssignment[]): Promise<number> {
  const now = new Date().toISOString();
  const stored = await db.lessons.bulkGet(assignments.map((a) => a.lesson.id));
  await db.lessons.bulkPut(
    assignments.map((a, i) => ({ ...a.lesson, ...stored[i], topic: a.topic, updatedAt: now })),
  );
  return assignments.length;
}
