/** Модель аналітичного звіту — спільна для PDF і DOCX. */
import { analyze, type Analysis } from '../domain/analysis';
import { METRIC_LABELS, delta, type Bucket, type Dataset, type MetricId } from '../domain/aggregate';
import { CATEGORIES } from '../domain/formSchema';
import { resolveItem } from '../domain/scoring';
import { MONTHS_SHORT, fmtDate, monthIndex } from '../domain/dates';
import { fmtDelta } from '../domain/insights';

export const REPORT_METRICS: MetricId[] = [
  'learningIndex',
  'behaviorIndex',
  'learning',
  'attention',
  'teacher',
  'independence',
  'behavior',
  'emotion',
  'social',
  'concentration',
  'attendance',
];

export interface ReportTable {
  head: string[];
  rows: string[][];
}

export interface ReportModel {
  analysis: Analysis;
  buckets: Bucket[];
  metricsTable: ReportTable;
  /** Частоти пунктів: одна таблиця на категорію. */
  itemTables: { title: string; unit: string; table: ReportTable }[];
  notes: { date: string; text: string }[];
  comments: { date: string; lesson: string; text: string }[];
}

const fmt = (v: number | null | undefined, unit = '') => (v == null ? '—' : `${Math.round(v)}${unit}`);

export function buildReport(ds: Dataset): ReportModel {
  const analysis = analyze(ds, 'month');
  const buckets = analysis.buckets.filter((b) => b.observed > 0 || b.observedDays > 0);
  const years = new Set(buckets.map((b) => b.key.slice(0, 4)));
  const col = (b: Bucket) => `${MONTHS_SHORT[monthIndex(b.key)]}${years.size > 1 ? ` ${b.key.slice(2, 4)}` : ''}`;
  const { current, previous } = analysis;
  const withDelta = !!(current && previous);

  const metricsTable: ReportTable = {
    head: ['Показник', ...buckets.map(col), 'Увесь період', ...(withDelta ? ['Зміна, п.п.'] : [])],
    rows: [
      ...REPORT_METRICS.map((m) => {
        const unit = m === 'attendance' || m === 'concentration' ? '%' : '';
        const d = delta(current?.metrics[m].value, previous?.metrics[m].value);
        return [
          METRIC_LABELS[m],
          ...buckets.map((b) => fmt(b.metrics[m].value, unit)),
          fmt(analysis.overall.metrics[m].value, unit),
          ...(withDelta ? [d == null ? '—' : fmtDelta(d)] : []),
        ];
      }),
      ['Заповнено уроків', ...buckets.map((b) => `${b.observed} з ${b.attended}`), `${analysis.overall.observed} з ${analysis.overall.attended}`, ...(withDelta ? [''] : [])],
    ],
  };

  const itemTables = CATEGORIES.map((cat) => ({
    title: cat.title,
    unit: cat.scope === 'day' ? '% днів' : '% уроків',
    table: {
      head: ['Пункт', ...buckets.map(col), ...(withDelta ? ['Зміна'] : [])],
      rows: cat.items.map((item) => {
        const pol = resolveItem(item, ds.settings).polarity;
        const c = current?.itemFreq[item.id]?.pct;
        const p = previous?.itemFreq[item.id]?.pct;
        const d = c != null && p != null ? c - p : null;
        return [
          `${pol === 1 ? '(+) ' : pol === -1 ? '(−) ' : ''}${item.label}`,
          ...buckets.map((b) => fmt(b.itemFreq[item.id]?.pct)),
          ...(withDelta ? [d == null ? '—' : fmtDelta(d)] : []),
        ];
      }),
    },
  }));

  const notes = ds.days
    .filter((d) => d.note?.trim())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: fmtDate(d.date, 'd MMM yyyy'), text: d.note!.trim() }));

  const lessonById = new Map(ds.lessons.map((l) => [l.id, l]));
  const comments = [...ds.obsById.values()]
    .filter((o) => o.comment?.trim() && lessonById.has(o.id))
    .sort((a, b) => (a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date.localeCompare(b.date)))
    .map((o) => ({
      date: fmtDate(o.date, 'd MMM yyyy'),
      lesson: `${o.lessonNumber}. ${lessonById.get(o.id)!.subject}`,
      text: o.comment!.trim(),
    }));

  return { analysis, buckets, metricsTable, itemTables, notes, comments };
}

export const METHOD_NOTE =
  'Методика. Для кожного пункту бланку частота — це частка уроків (для комунікації — днів), де пункт позначено, серед уроків із заповненою категорією; уроки з «н» не враховуються. ' +
  'Індекс категорії = 50 + 50 × (частка позначених позитивних пунктів − частка позначених негативних) з урахуванням ваг: 50 — нейтрально, 100 — лише позитивні прояви. ' +
  'Самостійність = 100 × (1 − підтримка), де підтримка — зважене поєднання рівня допомоги асистента й частки застосованих адаптацій. ' +
  'Індекс навчання — середнє з навчальної діяльності, уваги, взаємодії з вчителем і самостійності; індекс поведінки — середнє з поведінки, емоційного стану й комунікації. ' +
  'Висновки про зміну формуються лише за достатньої кількості заповнених уроків в обох періодах.';
