import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAttendanceWorkbook } from './attendanceXlsx';
import { nameMatches } from '../normalize';

/** Книга з одного аркуша з масиву рядків (тестова фікстура, аналог експорту Human). */
function book(rows: unknown[][], sheet = 'Аркуш1'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  // Прогін через запис/читання, як зі справжнім файлом.
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

const opts = { studentName: 'Коваленко Андрій', schoolYearStart: '2025-09-01' };

describe('nameMatches', () => {
  it('ігнорує порядок слів, регістр, ініціали й різні апострофи', () => {
    expect(nameMatches('Андрій Коваленко', 'Коваленко Андрій Петрович')).toBe(true);
    expect(nameMatches('КОВАЛЕНКО А.', 'Коваленко Андрій')).toBe(true);
    expect(nameMatches("Мар'яна Лук’янчук", 'Лукʼянчук Марʼяна')).toBe(true);
    expect(nameMatches('Коваленко Олег', 'Коваленко Андрій')).toBe(false);
    expect(nameMatches('А. К.', 'Коваленко Андрій')).toBe(false);
  });
});

describe('parseAttendanceWorkbook — сітка', () => {
  it('номери днів + місяць у заголовку файлу', () => {
    const wb = book([
      ['Облік відвідування. Листопад 2025'],
      ['№', 'Учень', 3, 4, 5, 6, 7, 10, 11],
      [1, 'Бондар Ірина', null, null, 'н', null, null, null, null],
      [2, 'Коваленко Андрій', 'н', null, null, 2, null, 'хв', null],
    ]);
    const res = parseAttendanceWorkbook(wb, opts);
    expect(res.matchedName).toBe('Коваленко Андрій');
    expect(res.needsMonth).toBe(false);
    expect(res.absences).toEqual([
      { date: '2025-11-03', marker: 'н', count: undefined },
      { date: '2025-11-06', marker: '2', count: 2 },
      { date: '2025-11-10', marker: 'хв', count: undefined },
    ]);
  });

  it('дати у форматі «01.09» без місяця у заголовку', () => {
    const wb = book([
      ['Учень', '01.09', '02.09', '03.09', '04.09', '05.09'],
      ['Коваленко Андрій', null, 'Н', null, null, 'н'],
    ]);
    const res = parseAttendanceWorkbook(wb, opts);
    expect(res.absences.map((a) => a.date)).toEqual(['2025-09-02', '2025-09-05']);
  });

  it('просить вказати місяць, якщо в заголовках лише номери днів', () => {
    const rows = [
      ['Учень', 1, 2, 3, 4, 5],
      ['Коваленко Андрій', 'н', null, null, null, null],
    ];
    const first = parseAttendanceWorkbook(book(rows), opts);
    expect(first.needsMonth).toBe(true);
    expect(first.absences).toEqual([]);
    const second = parseAttendanceWorkbook(book(rows), { ...opts, month: '2026-02' });
    expect(second.absences.map((a) => a.date)).toEqual(['2026-02-01']);
  });

  it('не плутає рядок іншого учня з числами пропусків із заголовком', () => {
    const wb = book([
      ['Вересень 2025'],
      ['Учень', 1, 2, 3, 4, 5, 8],
      ['Бондар Ірина', 1, 2, 3, 4, 5, 6],
      ['Коваленко Андрій', null, 'н', null, null, null, null],
    ]);
    expect(parseAttendanceWorkbook(wb, opts).absences).toEqual([{ date: '2025-09-02', marker: 'н', count: undefined }]);
  });

  it('учня не знайдено — повертає кандидатів для вибору', () => {
    const wb = book([
      ['Учень', 1, 2, 3, 4, 5],
      ['Бондар Ірина', null, 'н', null, null, null],
      ['Шевчук Олег', null, null, null, null, null],
    ]);
    const res = parseAttendanceWorkbook(wb, opts);
    expect(res.matchedName).toBeUndefined();
    expect(res.candidates).toEqual(['Бондар Ірина', 'Шевчук Олег']);
    expect(res.warnings[0]).toMatch(/не знайдено учня/);
  });
});

describe('parseAttendanceWorkbook — список', () => {
  it('колонки Дата / Урок / Предмет / Учень / Позначка', () => {
    const wb = book([
      ['Дата', 'Урок', 'Предмет', 'Учень', 'Позначка'],
      ['03.11.2025', 1, 'Математика', 'Коваленко Андрій', 'н'],
      ['03.11.2025', 2, 'Читання', 'Коваленко Андрій', ''],
      ['03.11.2025', 1, 'Математика', 'Бондар Ірина', 'н'],
      ['04.11.2025', 3, 'Мистецтво', 'Коваленко Андрій', 'Н'],
    ]);
    const res = parseAttendanceWorkbook(wb, opts);
    expect(res.absences).toEqual([
      { date: '2025-11-03', lessonNumber: 1, subject: 'Математика', marker: 'н', count: undefined },
      { date: '2025-11-04', lessonNumber: 3, subject: 'Мистецтво', marker: 'Н', count: undefined },
    ]);
  });
});
