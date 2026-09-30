/**
 * Готові періоди дашборда й звіту. Спільні для вебу й телефона: асистент має
 * бачити ті самі «I семестр» чи «останні 90 днів» на обох пристроях, інакше
 * однакові на вигляд звіти будуть про різні відрізки часу.
 */
import { todayISO } from './dates';
import type { ISODate, Student } from './types';

export type Preset = 'all' | 'year' | 'sem1' | 'sem2' | 'last90' | 'custom';

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'all', label: 'Увесь час (з даними)' },
  { id: 'year', label: 'Навчальний рік' },
  { id: 'sem1', label: 'I семестр' },
  { id: 'sem2', label: 'II семестр' },
  { id: 'last90', label: 'Останні 90 днів' },
  { id: 'custom', label: 'Свій період' },
];

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export const rangeDays = (r: DateRange): number => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400000);

export function resolveRange(
  preset: Preset,
  student: Student,
  extent: DateRange | null,
  custom: DateRange,
): DateRange {
  const today = todayISO();
  const clampTo = (d: ISODate) => (d > today ? today : d);
  const y = Number(student.yearStart.slice(0, 4));
  switch (preset) {
    case 'all':
      return extent ?? { from: student.yearStart, to: clampTo(student.yearEnd) };
    case 'year':
      return { from: student.yearStart, to: clampTo(student.yearEnd) };
    case 'sem1':
      return { from: student.yearStart, to: clampTo(`${y}-12-31`) };
    case 'sem2':
      return { from: `${y + 1}-01-01`, to: clampTo(student.yearEnd) };
    case 'last90': {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case 'custom':
      return custom;
  }
}
