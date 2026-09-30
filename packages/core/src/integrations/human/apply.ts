/** Запис підтверджених даних з Human у локальну базу. */
import { getStore } from '../../store/context';
import { getLessonsForRange } from '../../store/repo';
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
  await getStore().putMany('lessons', toPut);
  res.marked = toPut.length;
  return res;
}

export async function applyTopics(assignments: TopicAssignment[]): Promise<number> {
  const store = getStore();
  return store.tx(async () => {
    const rows = [];
    for (const a of assignments) {
      const stored = await store.get('lessons', a.lesson.id);
      rows.push({ ...a.lesson, ...stored, topic: a.topic });
    }
    await store.putMany('lessons', rows);
    return assignments.length;
  });
}
