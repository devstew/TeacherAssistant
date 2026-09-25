/**
 * Перетворює тижневий шаблон розкладу, дзвінки й канікули на уроки конкретних дат.
 * Згенеровані уроки не зберігаються в базі, доки їх не змінять (тема, «н»)
 * або не заповнять спостереження — тоді зберігається запис з тим самим id.
 */
import { eachDate, isoWeekday, maxISO, minISO, minutesBetween } from '../domain/dates';
import { lessonId, type Holiday, type ISODate, type Lesson, type Student, type TimetableSlot } from '../domain/types';

export function isHoliday(date: ISODate, holidays: readonly Holiday[]): boolean {
  return holidays.some((h) => h.from <= date && date <= h.to);
}

export function slotActive(slot: TimetableSlot, date: ISODate): boolean {
  return (!slot.validFrom || slot.validFrom <= date) && (!slot.validTo || date <= slot.validTo);
}

export function generateLessons(
  student: Student,
  slots: readonly TimetableSlot[],
  holidays: readonly Holiday[],
  from: ISODate,
  to: ISODate,
): Lesson[] {
  const start = maxISO(from, student.yearStart);
  const end = minISO(to, student.yearEnd);
  if (start > end) return [];
  const byWeekday = new Map<number, TimetableSlot[]>();
  for (const s of slots) {
    if (s.studentId !== student.id || !s.subject.trim()) continue;
    (byWeekday.get(s.weekday) ?? byWeekday.set(s.weekday, []).get(s.weekday)!).push(s);
  }
  const out: Lesson[] = [];
  for (const date of eachDate(start, end)) {
    const daySlots = byWeekday.get(isoWeekday(date));
    if (!daySlots || isHoliday(date, holidays)) continue;
    for (const slot of daySlots) {
      if (!slotActive(slot, date)) continue;
      out.push({
        id: lessonId(student.id, date, slot.lessonNumber),
        studentId: student.id,
        date,
        lessonNumber: slot.lessonNumber,
        subject: slot.subject.trim(),
        source: 'timetable',
      });
    }
  }
  return out;
}

/** Збережені уроки перекривають згенеровані з тим самим id; скасовані прибираються. */
export function mergeLessons(generated: readonly Lesson[], stored: readonly Lesson[]): Lesson[] {
  const byId = new Map(generated.map((l) => [l.id, l]));
  for (const l of stored) byId.set(l.id, { ...byId.get(l.id), ...l });
  return [...byId.values()]
    .filter((l) => !l.cancelled)
    .sort((a, b) => (a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date < b.date ? -1 : 1));
}

export function lessonTime(student: Student, lessonNumber: number): { start: string; end: string } | undefined {
  return student.bells.find((b) => b.lessonNumber === lessonNumber);
}

export function lessonDuration(student: Student, lessonNumber: number): number {
  const bell = lessonTime(student, lessonNumber);
  const mins = bell ? minutesBetween(bell.start, bell.end) : 0;
  return mins > 0 ? mins : student.lessonMinutes;
}
