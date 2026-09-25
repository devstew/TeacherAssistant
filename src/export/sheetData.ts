/** Дані для «щоденних аркушів» — копії паперового бланку. */
import type { Dataset } from '../db/repo';
import { hasDayData, hasObservationData } from '../domain/scoring';
import { fmtDate } from '../domain/dates';
import type { DayObservation, ISODate, Lesson, LessonObservation, Student } from '../domain/types';
import { lessonTime } from '../schedule/generateLessons';

export interface SheetLesson {
  lesson: Lesson;
  obs?: LessonObservation;
  time?: { start: string; end: string };
}

export interface SheetDay {
  date: ISODate;
  lessons: SheetLesson[];
  day?: DayObservation;
}

/** Уроків на одному аркуші — як на паперовому бланку. */
export const LESSONS_PER_SHEET = 5;

export function buildSheetDays(ds: Dataset, onlyFilled: boolean): SheetDay[] {
  const byDate = new Map<ISODate, SheetDay>();
  const get = (date: ISODate) => byDate.get(date) ?? byDate.set(date, { date, lessons: [] }).get(date)!;
  for (const lesson of ds.lessons) {
    get(lesson.date).lessons.push({ lesson, obs: ds.obsById.get(lesson.id), time: lessonTime(ds.student, lesson.lessonNumber) });
  }
  for (const d of ds.days) get(d.date).day = d;
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) d.lessons.sort((a, b) => a.lesson.lessonNumber - b.lesson.lessonNumber);
  if (!onlyFilled) return days;
  return days.filter((d) => hasDayData(d.day) || d.lessons.some((l) => l.lesson.absent || hasObservationData(l.obs)));
}

/** Порожній аркуш для друку: день без уроків у розкладі. */
export function blankSheetDay(student: Student, date: ISODate, count = LESSONS_PER_SHEET): SheetDay {
  return {
    date,
    lessons: Array.from({ length: count }, (_, i) => ({
      lesson: {
        id: `${student.id}:${date}:${i + 1}`,
        studentId: student.id,
        date,
        lessonNumber: i + 1,
        subject: '',
        source: 'manual' as const,
      },
      time: lessonTime(student, i + 1),
    })),
  };
}

export function chunk<T>(xs: T[], size: number): T[][] {
  if (!xs.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function studentLine(s: Student): string {
  return [`Дитина: ${s.name}`, s.className && `клас ${s.className}`, s.assistantName && `асистент: ${s.assistantName}`]
    .filter(Boolean)
    .join(' · ');
}

export const dayTitle = (date: ISODate) => fmtDate(date, 'd MMMM yyyy, EEEE');

export function periodLabel(from: ISODate, to: ISODate): string {
  return from === to ? fmtDate(from, 'd MMMM yyyy') : `${fmtDate(from, 'd MMMM yyyy')} — ${fmtDate(to, 'd MMMM yyyy')}`;
}
