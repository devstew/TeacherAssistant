/**
 * Розбір Excel-експорту відвідуваності з Human («Облік відвідування» за місяць
 * або «Експорт відвідуваності в Excel» з розділу «Аналітика»).
 *
 * Точний формат файлу Human публічно не описаний, тому розбір евристичний
 * і підтримує дві поширені форми:
 *  1. сітка: рядок учня × стовпці днів (дата, «01.09» або номер дня 1–31);
 *  2. список: рядки з колонками «Дата», «Учень», «Позначка» (+ «Урок», «Предмет»).
 * Результат завжди показується користувачу на попередньому перегляді перед записом.
 */
import * as XLSX from 'xlsx';
import type { ISODate } from '../../../domain/types';
import type { AbsenceRecord } from '../provider';
import {
  cellText,
  findMonth,
  findYear,
  isoFromParts,
  looksLikeName,
  nameMatches,
  normalizeName,
  parseDateCell,
  yearForMonth,
} from '../normalize';

export interface AttendanceParseOptions {
  studentName: string;
  schoolYearStart: ISODate;
  /** 'YYYY-MM', якщо у файлі лише номери днів і місяць не вдалося визначити. */
  month?: string;
}

export interface AttendanceParseResult {
  sheet?: string;
  matchedName?: string;
  /** Схожі на ПІБ значення з файлу — щоб вибрати учня вручну, якщо ім'я не знайдено. */
  candidates: string[];
  absences: AbsenceRecord[];
  warnings: string[];
  /** У заголовках лише номери днів — потрібно вказати місяць. */
  needsMonth: boolean;
}

type Row = unknown[];

const ABSENCE_MARKER = /^(н|нб|нп|н\/п|хв|хв\.|п|пп|пр|в|б|х|відс|відсутній)$/iu;

/** ArrayBuffer — з браузера, рядок base64 — з файлової системи телефона. */
export function readWorkbook(data: ArrayBuffer | string): XLSX.WorkBook {
  return XLSX.read(data, { type: typeof data === 'string' ? 'base64' : 'array', cellDates: true });
}

function sheetRows(ws: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null });
}

function markerOf(v: unknown): { marker: string; count?: number } | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    return Number.isInteger(v) && v >= 1 && v <= 12 ? { marker: String(v), count: v } : null;
  }
  const s = cellText(v);
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 12 ? { marker: s, count: n } : null;
  }
  return ABSENCE_MARKER.test(s) ? { marker: s } : null;
}

/** Дати й номери днів у заголовку йдуть за зростанням (допускаємо перехід через межу місяця). */
function mostlyIncreasing(values: (ISODate | number)[]): boolean {
  const nums = values.map((v) => (typeof v === 'string' ? Date.parse(v) : v));
  let up = 0;
  for (let i = 1; i < nums.length; i++) if (nums[i] > nums[i - 1]) up++;
  return nums.length > 1 && up / (nums.length - 1) >= 0.8;
}

function findHeaderIndex(rows: Row[], test: (cells: string[]) => boolean, limit = 30): number {
  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    if (test(rows[i].map((c) => normalizeName(cellText(c))))) return i;
  }
  return -1;
}

/** Форма «список»: колонки Дата / Учень / Позначка. */
function parseLongFormat(rows: Row[], opts: AttendanceParseOptions): AttendanceParseResult | null {
  const h = findHeaderIndex(
    rows,
    (cells) => cells.some((c) => c.includes('дата')) && cells.some((c) => /учен|піб|прізвище/.test(c)),
  );
  if (h < 0) return null;
  const header = rows[h].map((c) => normalizeName(cellText(c)));
  const col = (re: RegExp) => header.findIndex((c) => re.test(c));
  const dateCol = col(/дата/);
  const nameCol = col(/учен|піб|прізвище/);
  const markCol = col(/позначк|відвід|статус|пропуск|присутн/);
  const lessonCol = col(/^№|урок/);
  const subjectCol = col(/предмет/);
  const res: AttendanceParseResult = { candidates: [], absences: [], warnings: [], needsMonth: false };
  const names = new Set<string>();
  for (const row of rows.slice(h + 1)) {
    const name = cellText(row[nameCol]);
    if (!name) continue;
    names.add(name);
    if (!nameMatches(name, opts.studentName)) continue;
    res.matchedName = name;
    const date = parseDateCell(row[dateCol], opts.schoolYearStart);
    const mark = markerOf(markCol >= 0 ? row[markCol] : null);
    if (!date || !mark) continue;
    const lessonNumber = lessonCol >= 0 ? Number(cellText(row[lessonCol])) || undefined : undefined;
    const subject = subjectCol >= 0 ? cellText(row[subjectCol]) || undefined : undefined;
    res.absences.push({ date, marker: mark.marker, lessonNumber, subject, count: lessonNumber ? undefined : mark.count });
  }
  res.candidates = [...names].filter(looksLikeName).slice(0, 60);
  return res;
}

/** Форма «сітка»: знаходимо рядок учня і рядок заголовків з датами над ним. */
function parseGridFormat(rows: Row[], sheetName: string, opts: AttendanceParseOptions): AttendanceParseResult {
  const res: AttendanceParseResult = { candidates: [], absences: [], warnings: [], needsMonth: false };
  let studentRow = -1;
  const names = new Set<string>();
  rows.forEach((row, i) => {
    for (const c of row) {
      const t = cellText(c);
      if (!t || t.length > 80) continue;
      if (looksLikeName(t)) names.add(t);
      if (studentRow < 0 && nameMatches(t, opts.studentName)) {
        studentRow = i;
        res.matchedName = t;
      }
    }
  });
  res.candidates = [...names].slice(0, 60);
  if (studentRow < 0) return res;

  // Контекст місяця: назва аркуша, перші рядки файлу або вибір користувача.
  const titleText = [sheetName, ...rows.slice(0, Math.min(studentRow, 8)).flat().map(cellText)].join(' ');
  const titleMonth = findMonth(titleText);
  const titleYear = findYear(titleText);
  const chosenMonth = opts.month ? Number(opts.month.slice(5, 7)) - 1 : null;
  const chosenYear = opts.month ? Number(opts.month.slice(0, 4)) : null;
  const month0 = chosenMonth ?? titleMonth;
  const yearOf = (m: number) =>
    chosenYear ?? (titleYear != null && titleMonth === m ? titleYear : yearForMonth(m, opts.schoolYearStart));

  // Рядок заголовків: найближчий над учнем, де ≥ 5 клітинок схожі на дати або номери днів.
  let headerRow = -1;
  let colDates = new Map<number, ISODate | number>();
  for (let i = studentRow - 1; i >= 0; i--) {
    // Рядки інших учнів (з ПІБ і числами пропусків) заголовком бути не можуть.
    if (rows[i].some((c) => looksLikeName(cellText(c)))) continue;
    const map = new Map<number, ISODate | number>();
    rows[i].forEach((c, col) => {
      const iso = parseDateCell(c, opts.schoolYearStart);
      if (iso) return void map.set(col, iso);
      const t = cellText(c);
      if (/^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31) map.set(col, Number(t));
    });
    if (map.size >= 5 && mostlyIncreasing([...map.values()])) {
      headerRow = i;
      colDates = map;
      break;
    }
  }
  if (headerRow < 0) {
    res.warnings.push('Не знайдено рядок із датами над рядком учня.');
    return res;
  }

  // Двоярусний заголовок: над номерами днів можуть стояти назви місяців (об'єднані клітинки).
  const monthRow = headerRow > 0 ? rows[headerRow - 1] : [];
  let carryMonth: number | null = null;
  const monthByCol = new Map<number, number>();
  const maxCol = Math.max(...colDates.keys());
  for (let col = 0; col <= maxCol; col++) {
    const m = findMonth(cellText(monthRow[col]));
    if (m != null) carryMonth = m;
    if (carryMonth != null) monthByCol.set(col, carryMonth);
  }

  const row = rows[studentRow];
  let numericCount = 0;
  for (const [col, d] of colDates) {
    let date: ISODate | null = null;
    if (typeof d === 'string') date = d;
    else {
      const m = monthByCol.get(col) ?? month0;
      if (m == null) {
        res.needsMonth = true;
        continue;
      }
      date = isoFromParts(yearOf(m), m, d);
    }
    const mark = markerOf(row[col]);
    if (!mark) continue;
    if (mark.count != null) numericCount++;
    res.absences.push({ date, marker: mark.marker, count: mark.count });
  }
  if (res.needsMonth) {
    res.absences = [];
    res.warnings.push('У заголовках лише номери днів — оберіть місяць, за який вивантажено файл.');
  }
  if (numericCount > 0 && res.absences.some((a) => (a.count ?? 0) > 8)) {
    res.warnings.push('У рядку учня є числа більші за 8 — можливо, це оцінки, а не пропуски. Перевірте файл.');
  }
  return res;
}

export function parseAttendanceWorkbook(wb: XLSX.WorkBook, opts: AttendanceParseOptions): AttendanceParseResult {
  let best: AttendanceParseResult | null = null;
  const allCandidates = new Set<string>();
  for (const sheet of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[sheet]);
    if (!rows.length) continue;
    const res = parseLongFormat(rows, opts) ?? parseGridFormat(rows, sheet, opts);
    res.sheet = sheet;
    res.candidates.forEach((c) => allCandidates.add(c));
    if (res.matchedName && (!best || res.absences.length > best.absences.length)) best = res;
  }
  if (best) return best;
  return {
    candidates: [...allCandidates].slice(0, 60),
    absences: [],
    warnings: [`У файлі не знайдено учня «${opts.studentName}». Оберіть ім'я зі списку.`],
    needsMonth: false,
  };
}
