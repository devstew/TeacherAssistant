/**
 * Розбір КТП (календарно-тематичного планування) з Excel — того самого файлу,
 * який учитель імпортує в Human («Імпорт змісту курсу з Excel»).
 * Потрібна колонка з темою; колонка з датою — необов'язкова.
 */
import * as XLSX from 'xlsx';
import type { ISODate, Lesson } from '../../../domain/types';
import type { TopicRecord } from '../provider';
import { cellText, normalizeName, parseDateCell } from '../normalize';

export interface TopicsParseResult {
  sheet?: string;
  topics: TopicRecord[];
  hasDates: boolean;
  warnings: string[];
}

type Row = unknown[];

export function parseTopicsWorkbook(wb: XLSX.WorkBook, schoolYearStart: ISODate): TopicsParseResult {
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheet], { header: 1, raw: true, defval: null });
    if (!rows.length) continue;
    const res = parseRows(rows, schoolYearStart);
    if (res.topics.length) return { ...res, sheet };
  }
  return { topics: [], hasDates: false, warnings: ['У файлі не знайдено тем уроків.'] };
}

function parseRows(rows: Row[], schoolYearStart: ISODate): TopicsParseResult {
  const warnings: string[] = [];
  let headerIdx = -1;
  let topicCol = -1;
  let dateCol = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].map((c) => normalizeName(cellText(c)));
    const t = cells.findIndex((c) => /^тема|тема уроку|зміст|назва уроку/.test(c));
    if (t >= 0) {
      headerIdx = i;
      topicCol = t;
      dateCol = cells.findIndex((c) => c.includes('дата'));
      break;
    }
  }
  const body = rows.slice(headerIdx + 1);
  if (topicCol < 0) {
    // Без заголовка: тема — колонка з найдовшим середнім текстом.
    const width = Math.max(0, ...body.map((r) => r.length));
    let bestLen = 0;
    for (let c = 0; c < width; c++) {
      const texts = body.map((r) => cellText(r[c])).filter((s) => s && !/^\d+([./]\d+)*$/.test(s));
      const avg = texts.length ? texts.reduce((s, x) => s + x.length, 0) / texts.length : 0;
      if (avg > bestLen) {
        bestLen = avg;
        topicCol = c;
      }
    }
    if (topicCol < 0) return { topics: [], hasDates: false, warnings };
    warnings.push('Колонку «Тема» не знайдено — узято колонку з найдовшими текстами.');
  }
  if (dateCol < 0) {
    const width = Math.max(0, ...body.map((r) => r.length));
    for (let c = 0; c < width && dateCol < 0; c++) {
      if (c === topicCol) continue;
      const values = body.map((r) => r[c]).filter((v) => cellText(v));
      const dates = values.filter((v) => parseDateCell(v, schoolYearStart));
      if (values.length && dates.length / values.length >= 0.5) dateCol = c;
    }
  }
  const topics: TopicRecord[] = [];
  for (const r of body) {
    const topic = cellText(r[topicCol]);
    if (!topic || /^тема$/i.test(topic)) continue;
    const date = dateCol >= 0 ? parseDateCell(r[dateCol], schoolYearStart) ?? undefined : undefined;
    topics.push({ topic, date });
  }
  return { topics, hasDates: topics.some((t) => t.date), warnings };
}

export interface TopicAssignment {
  lesson: Lesson;
  topic: string;
}

/**
 * Зіставляє теми з уроками предмета.
 * 'date' — тема з датою потрапляє на перший вільний урок цього предмета в ту дату;
 * 'sequence' — теми по черзі розподіляються на уроки, починаючи з startDate.
 */
export function planTopicAssignment(
  topics: TopicRecord[],
  subjectLessons: Lesson[],
  mode: 'date' | 'sequence',
  startDate?: ISODate,
): TopicAssignment[] {
  const lessons = [...subjectLessons].sort((a, b) =>
    a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date.localeCompare(b.date),
  );
  if (mode === 'sequence') {
    const pool = lessons.filter((l) => !startDate || l.date >= startDate);
    return topics.slice(0, pool.length).map((t, i) => ({ lesson: pool[i], topic: t.topic }));
  }
  const used = new Set<string>();
  const out: TopicAssignment[] = [];
  for (const t of topics) {
    if (!t.date) continue;
    const lesson = lessons.find((l) => l.date === t.date && !used.has(l.id));
    if (!lesson) continue;
    used.add(lesson.id);
    out.push({ lesson, topic: t.topic });
  }
  return out;
}
