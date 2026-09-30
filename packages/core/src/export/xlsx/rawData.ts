/**
 * Сирі дані в Excel: уроки, дні, показники по місяцях і частоти пунктів —
 * для власного аналізу. Книга будується тут, а записує її кожна платформа
 * по-своєму: браузер у Blob, телефон — у файл.
 */
import * as XLSX from 'xlsx';
import { analyze } from '../../domain/analysis';
import { METRIC_LABELS, type Dataset } from '../../domain/aggregate';
import { ALL_ITEMS, HELP_LABEL, LESSON_CATEGORIES, SOCIAL } from '../../domain/formSchema';
import { hasObservationData, scoreDay, scoreLesson } from '../../domain/scoring';
import { WEEKDAYS_SHORT, isoWeekday } from '../../domain/dates';
import { REPORT_METRICS } from '../reportData';

const round = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

function sheet(rows: (string | number | null)[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

export function rawDataWorkbook(ds: Dataset): XLSX.WorkBook {
  const lessonItems = LESSON_CATEGORIES.flatMap((c) => c.items);
  const lessonMetrics = ['learning', 'attention', 'emotion', 'behavior', 'teacher', 'independence', 'concentration'] as const;

  const lessonsSheet = [
    [
      'Дата', 'День', '№', 'Предмет', 'Тема', 'Відсутність', 'Спостереження', 'Рівень допомоги', 'Утримує увагу, хв', 'Коментар',
      ...lessonItems.map((i) => i.label),
      ...lessonMetrics.map((m) => METRIC_LABELS[m]),
    ],
    ...ds.lessons.map((l) => {
      const obs = ds.obsById.get(l.id);
      const has = hasObservationData(obs);
      const checks = new Set(obs?.checks ?? []);
      const scores = has && !l.absent ? scoreLesson(obs, ds.settings, ds.lessonMinutes(l)) : null;
      return [
        l.date,
        WEEKDAYS_SHORT[isoWeekday(l.date) - 1],
        l.lessonNumber,
        l.subject,
        l.topic ?? '',
        l.absent ? (l.absenceMarker ?? 'н') : '',
        has ? 'так' : '',
        obs?.helpLevel ? HELP_LABEL[obs.helpLevel] : '',
        obs?.attentionMinutes ?? null,
        obs?.comment ?? '',
        ...lessonItems.map((i) => (has ? (checks.has(i.id) ? 1 : 0) : null)),
        ...lessonMetrics.map((m) => round(scores?.[m] ?? null)),
      ];
    }),
  ];

  const daysSheet = [
    ['Дата', 'День', ...SOCIAL.items.map((i) => i.label), METRIC_LABELS.social, 'Примітка'],
    ...[...ds.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const checks = new Set(d.checks);
        return [
          d.date,
          WEEKDAYS_SHORT[isoWeekday(d.date) - 1],
          ...SOCIAL.items.map((i) => (d.checks.length ? (checks.has(i.id) ? 1 : 0) : null)),
          round(scoreDay(d, ds.settings).social),
          d.note ?? '',
        ];
      }),
  ];

  const a = analyze(ds, 'month');
  const buckets = a.buckets.filter((b) => b.observed > 0 || b.observedDays > 0);
  const monthsSheet = [
    ['Місяць', 'Заплановано уроків', 'Відсутність', 'Заповнено уроків', 'Днів із підсумком', ...REPORT_METRICS.map((m) => METRIC_LABELS[m])],
    ...buckets.map((b) => [b.label, b.scheduled, b.absent, b.observed, b.observedDays, ...REPORT_METRICS.map((m) => round(b.metrics[m].value))]),
  ];

  const freqSheet = [
    ['Пункт', 'Полярність', ...buckets.map((b) => `${b.label}, %`)],
    ...ALL_ITEMS.map((i) => [
      i.label,
      (ds.settings.itemOverrides[i.id]?.polarity ?? i.polarity) === 1 ? '+' : (ds.settings.itemOverrides[i.id]?.polarity ?? i.polarity) === -1 ? '−' : '0',
      ...buckets.map((b) => round(b.itemFreq[i.id]?.pct ?? null)),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(lessonsSheet, [11, 5, 4, 22, 30, 11, 14, 14, 10, 30, ...lessonItems.map(() => 8), ...lessonMetrics.map(() => 12)]), 'Уроки');
  XLSX.utils.book_append_sheet(wb, sheet(daysSheet, [11, 5, ...SOCIAL.items.map(() => 8), 12, 50]), 'Дні');
  XLSX.utils.book_append_sheet(wb, sheet(monthsSheet, [16, 12, 11, 12, 12, ...REPORT_METRICS.map(() => 14)]), 'Місяці');
  XLSX.utils.book_append_sheet(wb, sheet(freqSheet, [48, 11, ...buckets.map(() => 14)]), 'Частоти пунктів');
  return wb;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
