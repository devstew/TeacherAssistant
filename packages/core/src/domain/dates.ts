import {
  addDays,
  differenceInCalendarDays,
  endOfISOWeek,
  endOfMonth,
  format,
  getISODay,
  parseISO,
  startOfISOWeek,
} from 'date-fns';
import { uk } from 'date-fns/locale';
import type { ISODate } from './types';

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const todayISO = (): ISODate => toISO(new Date());
export const addDaysISO = (date: ISODate, n: number): ISODate => toISO(addDays(parseISO(date), n));
export const isoWeekday = (date: ISODate): number => getISODay(parseISO(date));
export const weekStartISO = (date: ISODate): ISODate => toISO(startOfISOWeek(parseISO(date)));
export const weekEndISO = (date: ISODate): ISODate => toISO(endOfISOWeek(parseISO(date)));
export const monthKey = (date: ISODate): string => date.slice(0, 7);
export const monthStartISO = (key: string): ISODate => `${key}-01`;
export const monthEndISO = (key: string): ISODate => toISO(endOfMonth(parseISO(`${key}-01`)));

export const minISO = (a: ISODate, b: ISODate) => (a < b ? a : b);
export const maxISO = (a: ISODate, b: ISODate) => (a > b ? a : b);

export function eachDate(from: ISODate, to: ISODate): ISODate[] {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from));
  const out: ISODate[] = [];
  for (let i = 0; i <= days; i++) out.push(addDaysISO(from, i));
  return out;
}

/** Форматування з українською локаллю: «22 вересня 2026». */
export const fmtDate = (date: ISODate, pattern = 'd MMMM yyyy') => format(parseISO(date), pattern, { locale: uk });

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const WEEKDAYS_FULL = ['понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя'];

export const MONTHS_NOM = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
];
/** «у листопаді» */
export const MONTHS_LOC = [
  'у січні', 'у лютому', 'у березні', 'у квітні', 'у травні', 'у червні',
  'у липні', 'у серпні', 'у вересні', 'у жовтні', 'у листопаді', 'у грудні',
];
/** «порівняно з листопадом» */
export const MONTHS_INS = [
  'з січнем', 'з лютим', 'з березнем', 'з квітнем', 'з травнем', 'з червнем',
  'з липнем', 'з серпнем', 'з вереснем', 'з жовтнем', 'з листопадом', 'з груднем',
];
export const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

export const monthIndex = (key: string) => Number(key.slice(5, 7)) - 1;

/** «3–9 лис» або «27 жов – 2 лис» */
export function weekLabel(start: ISODate): string {
  const end = addDaysISO(start, 6);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Навчальний рік, до якого належить дата: вересень–травень. */
export function schoolYearFor(date: ISODate): { label: string; start: ISODate; end: ISODate } {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const startYear = m >= 8 ? y : y - 1;
  return { label: `${startYear}/${startYear + 1}`, start: `${startYear}-09-01`, end: `${startYear + 1}-05-31` };
}
