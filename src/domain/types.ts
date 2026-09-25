import type { HelpLevel, Polarity } from './formSchema';

/** Дата у форматі YYYY-MM-DD. */
export type ISODate = string;

export interface Bell {
  lessonNumber: number;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
}

export interface Student {
  id: string;
  /** ПІБ або псевдонім. */
  name: string;
  className: string;
  /** Напр. «2026/2027». */
  schoolYear: string;
  /** Межі навчального року: поза ними уроки з розкладу не генеруються. */
  yearStart: ISODate;
  yearEnd: ISODate;
  /** ПІБ асистента для шапки документів. */
  assistantName: string;
  /** Ім'я так, як воно записане в Human (для зіставлення при імпорті). */
  humanName?: string;
  /** Тривалість уроку за замовчуванням, хв. */
  lessonMinutes: number;
  bells: Bell[];
  isDemo?: boolean;
  createdAt: string;
}

export interface TimetableSlot {
  id: string;
  studentId: string;
  /** 1 = понеділок … 7 = неділя (ISO). */
  weekday: number;
  lessonNumber: number;
  subject: string;
  validFrom?: ISODate;
  validTo?: ISODate;
}

export interface Holiday {
  id: string;
  studentId: string;
  from: ISODate;
  to: ISODate;
  title: string;
}

export type LessonSource = 'timetable' | 'manual' | 'human-file' | 'human-api';

export interface Lesson {
  /** `${studentId}:${date}:${lessonNumber}` — повторний імпорт не створює дублікатів. */
  id: string;
  studentId: string;
  date: ISODate;
  lessonNumber: number;
  subject: string;
  topic?: string;
  absent?: boolean;
  /** Позначка відсутності як у джерелі («н», «хв» …). */
  absenceMarker?: string;
  cancelled?: boolean;
  source: LessonSource;
  updatedAt?: string;
}

export interface LessonObservation {
  /** = id уроку. */
  id: string;
  studentId: string;
  date: ISODate;
  lessonNumber: number;
  /** Id позначених пунктів (усі категорії рівня уроку, включно з адаптаціями). */
  checks: string[];
  helpLevel?: HelpLevel;
  /** Скільки хвилин дитина утримувала увагу (поле «Не стійка ____» на бланку). */
  attentionMinutes?: number;
  comment?: string;
  updatedAt: string;
}

export interface DayObservation {
  /** `${studentId}:${date}` */
  id: string;
  studentId: string;
  date: ISODate;
  /** Позначені комунікативні та соціальні навички. */
  checks: string[];
  /** Примітка: досягнення, труднощі, навички самообслуговування, рекомендації. */
  note?: string;
  updatedAt: string;
}

export interface ItemOverride {
  polarity?: Polarity;
  weight?: number;
}

export interface Settings {
  id: 'global';
  itemOverrides: Record<string, ItemOverride>;
  independence: {
    levelWeight: number;
    adaptWeight: number;
    levels: Record<HelpLevel, number>;
  };
  insights: {
    /** Мінімум спостережених уроків у кожному з порівнюваних періодів. */
    minLessons: number;
    /** Мінімальна зміна індексу, п.п. */
    minDelta: number;
    /** Мінімальна зміна частоти окремого пункту, п.п. */
    minItemDelta: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'global',
  itemOverrides: {},
  independence: {
    levelWeight: 0.7,
    adaptWeight: 0.3,
    levels: { none: 0, periodic: 1 / 3, partial: 2 / 3, full: 1 },
  },
  insights: { minLessons: 8, minDelta: 5, minItemDelta: 10 },
};

export const lessonId = (studentId: string, date: ISODate, lessonNumber: number) =>
  `${studentId}:${date}:${lessonNumber}`;

export const dayId = (studentId: string, date: ISODate) => `${studentId}:${date}`;

export const DEFAULT_BELLS: Bell[] = [
  { lessonNumber: 1, start: '08:30', end: '09:15' },
  { lessonNumber: 2, start: '09:25', end: '10:10' },
  { lessonNumber: 3, start: '10:30', end: '11:15' },
  { lessonNumber: 4, start: '11:35', end: '12:20' },
  { lessonNumber: 5, start: '12:30', end: '13:15' },
  { lessonNumber: 6, start: '13:25', end: '14:10' },
  { lessonNumber: 7, start: '14:20', end: '15:05' },
];

export function newId(): string {
  return crypto.randomUUID();
}
