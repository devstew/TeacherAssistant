import { describe, expect, it } from 'vitest';
import { generateLessons, lessonDuration, mergeLessons } from './generateLessons';
import { DEFAULT_BELLS, type Holiday, type Student, type TimetableSlot } from '../domain/types';

const student: Student = {
  id: 's', name: 'Тест', className: '3-А', schoolYear: '2025/2026', yearStart: '2025-09-01', yearEnd: '2026-05-31',
  assistantName: '', lessonMinutes: 45, bells: DEFAULT_BELLS, createdAt: '',
};
const slot = (weekday: number, lessonNumber: number, subject: string, extra: Partial<TimetableSlot> = {}): TimetableSlot => ({
  id: `${weekday}-${lessonNumber}`, studentId: 's', weekday, lessonNumber, subject, ...extra,
});

describe('generateLessons', () => {
  const slots = [slot(1, 1, 'Математика'), slot(1, 2, 'Читання'), slot(3, 1, 'Українська мова')];

  it('створює уроки за днями тижня', () => {
    // 2025-11-03 — понеділок, 2025-11-05 — середа
    const ls = generateLessons(student, slots, [], '2025-11-03', '2025-11-09');
    expect(ls.map((l) => `${l.date}#${l.lessonNumber} ${l.subject}`)).toEqual([
      '2025-11-03#1 Математика',
      '2025-11-03#2 Читання',
      '2025-11-05#1 Українська мова',
    ]);
    expect(ls[0].id).toBe('s:2025-11-03:1');
  });

  it('пропускає канікули й дати поза навчальним роком', () => {
    const holidays: Holiday[] = [{ id: 'h', studentId: 's', from: '2025-11-03', to: '2025-11-04', title: 'Канікули' }];
    expect(generateLessons(student, slots, holidays, '2025-11-03', '2025-11-05').map((l) => l.date)).toEqual(['2025-11-05']);
    expect(generateLessons(student, slots, [], '2025-08-25', '2025-08-31')).toEqual([]);
    expect(generateLessons(student, slots, [], '2026-06-01', '2026-06-07')).toEqual([]);
  });

  it('враховує межі дії слота', () => {
    const limited = [slot(1, 1, 'Математика', { validTo: '2025-11-05' }), slot(1, 1, 'Алгебра', { id: 'x', validFrom: '2025-11-06' })];
    const ls = generateLessons(student, limited, [], '2025-11-03', '2025-11-10');
    expect(ls.map((l) => l.subject)).toEqual(['Математика', 'Алгебра']);
  });
});

describe('mergeLessons', () => {
  it('збережені зміни перекривають згенеровані, скасовані прибираються', () => {
    const gen = generateLessons(student, [slot(1, 1, 'Математика'), slot(1, 2, 'Читання')], [], '2025-11-03', '2025-11-03');
    const merged = mergeLessons(gen, [
      { ...gen[0], topic: 'Таблиця множення', absent: true },
      { ...gen[1], cancelled: true },
      { id: 's:2025-11-03:5', studentId: 's', date: '2025-11-03', lessonNumber: 5, subject: 'Гурток', source: 'manual' },
    ]);
    expect(merged.map((l) => [l.lessonNumber, l.subject, l.topic, l.absent])).toEqual([
      [1, 'Математика', 'Таблиця множення', true],
      [5, 'Гурток', undefined, undefined],
    ]);
  });
});

describe('lessonDuration', () => {
  it('береться з дзвінків, інакше — зі значення за замовчуванням', () => {
    expect(lessonDuration(student, 1)).toBe(45);
    expect(lessonDuration({ ...student, bells: [], lessonMinutes: 40 }, 1)).toBe(40);
  });
});
