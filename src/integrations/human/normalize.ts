/** Нормалізація імен і розбір клітинок Excel для імпорту з Human. */
import { toISO } from '../../domain/dates';
import type { ISODate } from '../../domain/types';

const APOSTROPHES = /['’ʼ`´‘]/g;

export function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase('uk')
    .replace(APOSTROPHES, 'ʼ')
    .replace(/ё/g, 'е')
    .replace(/[.,;:()«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (s: string) => normalizeName(s).split(' ').filter(Boolean);

/** Токени збігаються, якщо рівні або один із них — ініціал іншого («п» і «петро»). */
const tokenEq = (a: string, b: string) =>
  a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/**
 * Чи записано в клітинці ту саму людину. Порядок слів і ініціали не важливі:
 * «Іваненко Петро», «Петро Іваненко», «Іваненко П.» відповідають «Іваненко Петро Іванович».
 */
export function nameMatches(cell: string, target: string): boolean {
  const a = tokens(cell);
  const b = tokens(target);
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === 1) return short[0].length > 2 && long.includes(short[0]);
  const used = new Set<number>();
  // Хоча б один токен має збігтися повністю (не лише ініціали).
  let fullMatch = false;
  for (const t of short) {
    const i = long.findIndex((u, idx) => !used.has(idx) && tokenEq(t, u));
    if (i < 0) return false;
    used.add(i);
    if (t.length > 1 && long[i].length > 1) fullMatch = true;
  }
  return fullMatch;
}

/** Схоже на ПІБ: 2–3 слова кирилицею з великої літери. */
export function looksLikeName(s: string): boolean {
  const t = s.trim();
  return /^[А-ЯІЇЄҐ][а-яіїєґʼ'’-]+(\s+[А-ЯІЇЄҐ][а-яіїєґʼ'’.-]*){1,2}$/u.test(t);
}

export function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return toISO(v);
  return String(v).trim();
}

const MONTH_STEMS = ['січ', 'лют', 'берез', 'квіт', 'трав', 'черв', 'лип', 'серп', 'верес', 'жовт', 'листопад', 'груд'];

/** Шукає назву місяця в тексті («Вересень 2026», «вересня»). Повертає 0–11 або null. */
export function findMonth(text: string): number | null {
  const t = text.toLocaleLowerCase('uk');
  for (let i = 0; i < MONTH_STEMS.length; i++) {
    if (new RegExp(`(^|[^а-яіїєґ])${MONTH_STEMS[i]}`, 'u').test(t)) return i;
  }
  return null;
}

export function findYear(text: string): number | null {
  const m = text.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

/** Рік для місяця в межах навчального року (вересень–грудень — перший рік). */
export function yearForMonth(month0: number, schoolYearStart: ISODate): number {
  const y = Number(schoolYearStart.slice(0, 4));
  return month0 >= 7 ? y : y + 1;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Розбирає клітинку з датою: Date (cellDates), серійне число Excel, «01.09.2026», «01.09», «2026-09-01».
 * Для «01.09» рік визначається за навчальним роком.
 */
export function parseDateCell(v: unknown, schoolYearStart: ISODate): ISODate | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toISO(v);
  const s = cellText(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    let y = m[3] ? Number(m[3]) : yearForMonth(mo - 1, schoolYearStart);
    if (y < 100) y += 2000;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

export const isoFromParts = (y: number, month0: number, day: number): ISODate => `${y}-${pad(month0 + 1)}-${pad(day)}`;
