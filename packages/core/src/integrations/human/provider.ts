/**
 * Джерело даних Human. Публічного API в Human немає, тому зараз дані приходять
 * з Excel-файлів, які вчитель вивантажує з Human. Інтерфейс спільний: коли
 * з'явиться офіційний доступ, достатньо реалізувати ApiProvider.
 */
import type { DateRange } from '../../domain/periods';
import type { ISODate } from '../../domain/types';

export interface AbsenceRecord {
  date: ISODate;
  lessonNumber?: number;
  subject?: string;
  /** Позначка як у файлі: «н», «хв», «2» … */
  marker: string;
  /** Скільки уроків пропущено за день, якщо у файлі стоїть число. */
  count?: number;
}

export interface TopicRecord {
  date?: ISODate;
  topic: string;
}

export interface ScheduleRecord {
  weekday: number;
  lessonNumber: number;
  subject: string;
}

export interface HumanDataProvider {
  readonly kind: 'file' | 'api';
  getAbsences(range: DateRange): Promise<AbsenceRecord[]>;
  getTopics(range: DateRange): Promise<TopicRecord[]>;
  getSchedule(): Promise<ScheduleRecord[]>;
}

const inRange = (d: ISODate | undefined, r: DateRange) => !d || (r.from <= d && d <= r.to);

/** Дані, розібрані з файлів експорту Human. */
export class FileProvider implements HumanDataProvider {
  readonly kind = 'file' as const;
  private readonly data: {
    absences?: AbsenceRecord[];
    topics?: TopicRecord[];
    schedule?: ScheduleRecord[];
  };

  constructor(data: FileProvider['data']) {
    this.data = data;
  }

  async getAbsences(range: DateRange) {
    return (this.data.absences ?? []).filter((a) => inRange(a.date, range));
  }

  async getTopics(range: DateRange) {
    return (this.data.topics ?? []).filter((t) => inRange(t.date, range));
  }

  async getSchedule() {
    return this.data.schedule ?? [];
  }
}

/**
 * Заготовка під офіційне API Human (після партнерської домовленості).
 * Ключі не можна зберігати у браузері — запити підуть через серверний проксі.
 */
export class ApiProvider implements HumanDataProvider {
  readonly kind = 'api' as const;

  private unavailable(): never {
    throw new Error('Офіційного API Human поки немає. Використайте імпорт Excel-файлів з Human.');
  }

  async getAbsences(): Promise<AbsenceRecord[]> {
    this.unavailable();
  }

  async getTopics(): Promise<TopicRecord[]> {
    this.unavailable();
  }

  async getSchedule(): Promise<ScheduleRecord[]> {
    this.unavailable();
  }
}
