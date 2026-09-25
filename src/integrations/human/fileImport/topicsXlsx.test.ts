import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseTopicsWorkbook, planTopicAssignment } from './topicsXlsx';
import type { Lesson } from '../../../domain/types';

function book(rows: unknown[][]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'КТП');
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true });
}

const lesson = (date: string, n: number): Lesson => ({
  id: `s:${date}:${n}`, studentId: 's', date, lessonNumber: n, subject: 'Математика', source: 'timetable',
});

describe('parseTopicsWorkbook', () => {
  it('знаходить колонки «Тема» і «Дата»', () => {
    const res = parseTopicsWorkbook(
      book([
        ['№', 'Дата', 'Тема уроку', 'Примітка'],
        [1, '03.11', 'Таблиця множення на 2', ''],
        [2, '05.11', 'Таблиця множення на 3', ''],
      ]),
      '2025-09-01',
    );
    expect(res.hasDates).toBe(true);
    expect(res.topics).toEqual([
      { topic: 'Таблиця множення на 2', date: '2025-11-03' },
      { topic: 'Таблиця множення на 3', date: '2025-11-05' },
    ]);
  });

  it('без заголовка бере колонку з найдовшими текстами', () => {
    const res = parseTopicsWorkbook(book([[1, 'Нумерація в межах 100'], [2, 'Задачі на дві дії']]), '2025-09-01');
    expect(res.topics.map((t) => t.topic)).toEqual(['Нумерація в межах 100', 'Задачі на дві дії']);
    expect(res.hasDates).toBe(false);
    expect(res.warnings.length).toBe(1);
  });
});

describe('planTopicAssignment', () => {
  const lessons = [lesson('2025-11-05', 2), lesson('2025-11-03', 1), lesson('2025-11-10', 1)];

  it('послідовно від дати початку', () => {
    const plan = planTopicAssignment([{ topic: 'A' }, { topic: 'B' }, { topic: 'C' }], lessons, 'sequence', '2025-11-04');
    expect(plan.map((p) => [p.lesson.date, p.topic])).toEqual([
      ['2025-11-05', 'A'],
      ['2025-11-10', 'B'],
    ]);
  });

  it('за датами', () => {
    const plan = planTopicAssignment(
      [{ topic: 'A', date: '2025-11-03' }, { topic: 'B', date: '2025-11-04' }, { topic: 'C', date: '2025-11-10' }],
      lessons,
      'date',
    );
    expect(plan.map((p) => [p.lesson.date, p.topic])).toEqual([
      ['2025-11-03', 'A'],
      ['2025-11-10', 'C'],
    ]);
  });
});
