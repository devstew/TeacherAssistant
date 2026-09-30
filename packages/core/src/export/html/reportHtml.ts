/**
 * Аналітичний звіт за період як HTML: висновки, показники по місяцях, графіки,
 * частоти пунктів, примітки асистента й методика. Той самий зміст, що у
 * веб-версії PDF — школа має отримувати однаковий документ з будь-якого пристрою.
 */
import { HELP_LEVELS } from '../../domain/formSchema';
import { MONTHS_SHORT, monthIndex } from '../../domain/dates';
import type { Student } from '../../domain/types';
import type { ChartRow } from '../../charts/geometry';
import { VIZ_LIGHT } from '../../charts/palette';
import { METHOD_NOTE, type ReportModel } from '../reportData';
import { studentLine } from '../sheetData';
import { MUTED, escapeHtml, htmlDocument, tableHtml } from './kit';
import { legendHtml, stackSvg, trendSvg, type ChartSeries } from './svgCharts';

const REPORT_CSS = `
  body { font-size: 8.5pt; }
  .page { padding: 0 2mm; }
  h1 { font-size: 15pt; margin: 0; }
  h2 { font-size: 11pt; margin: 12pt 0 5pt; }
  h3 { font-size: 9pt; margin: 6pt 0 3pt; }
  .bullet { display: flex; gap: 5pt; margin-bottom: 3pt; }
  .small { font-size: 7.5pt; color: ${MUTED}; }
  .note-date { width: 62pt; color: ${MUTED}; flex: none; }
  .note-lesson { width: 96pt; flex: none; }
  table { margin-bottom: 8pt; }
`;

const chartTitles = [
  'Динаміка індексів навчання й поведінки (0–100, 50 — нейтрально)',
  'Допомога асистента: розподіл уроків за рівнем, %',
];

export function reportHtml(student: Student, period: string, report: ReportModel, generatedAt: string): string {
  const { analysis } = report;
  const o = analysis.overall;
  const col = (key: string) => MONTHS_SHORT[monthIndex(key)];

  const trendSeries: ChartSeries[] = [
    { key: 'learningIndex', name: 'Індекс навчання', color: VIZ_LIGHT.s1 },
    { key: 'behaviorIndex', name: 'Індекс поведінки', color: VIZ_LIGHT.s2 },
  ];
  const trendRows: ChartRow[] = report.buckets.map((b) => ({
    label: col(b.key),
    learningIndex: b.metrics.learningIndex.value,
    behaviorIndex: b.metrics.behaviorIndex.value,
  }));

  const helpSeries: ChartSeries[] = HELP_LEVELS.map((h, i) => ({ key: h.id, name: h.label, color: VIZ_LIGHT.ord[i] }));
  const helpRows: ChartRow[] = analysis.buckets
    .filter((b) => b.help.n > 0)
    .map((b) => ({
      label: col(b.key),
      ...Object.fromEntries(HELP_LEVELS.map((h) => [h.id, (100 * b.help[h.id]) / b.help.n])),
    }));

  const charts = [
    trendRows.length ? `${legendHtml(trendSeries)}${trendSvg(trendRows, trendSeries)}` : '',
    helpRows.length ? `${legendHtml(helpSeries, 'rect')}${stackSvg(helpRows, helpSeries)}` : '',
  ];

  const body = `
  <div class="page">
    <h1>Аналітичний звіт спостережень асистента вчителя</h1>
    <div class="sub">${escapeHtml(studentLine(student))}</div>
    <div class="sub">Період: ${escapeHtml(period)} · сформовано ${escapeHtml(generatedAt)}</div>
    <div class="sub">Заплановано уроків: ${o.scheduled}, відсутність: ${o.absent}, заповнено спостережень: ${o.observed} з ${o.attended} відвіданих, днів із підсумком: ${o.observedDays}.</div>

    <h2>Висновки</h2>
    ${analysis.insights
      .map(
        (i, idx) =>
          `<div class="bullet"><span>•</span><span${idx === 0 ? ' class="bold"' : ''}>${escapeHtml(i.text)}</span></div>`,
      )
      .join('')}

    <h2>Показники по місяцях</h2>
    ${tableHtml(report.metricsTable, 28, 7.8)}

    ${charts
      .map((svg, i) => (svg ? `<div style="margin-bottom:8pt"><h3>${escapeHtml(chartTitles[i])}</h3>${svg}</div>` : ''))
      .join('')}
  </div>

  <div class="page">
    <h2>Частота пунктів бланку по місяцях</h2>
    <div class="small">(+) позитивний пункт, (−) негативний. Для негативних пунктів зменшення частоти — покращення.</div>
    ${report.itemTables
      .map((it) => `<h3>${escapeHtml(it.title)}, ${escapeHtml(it.unit)}</h3>${tableHtml(it.table, 46, 7.2)}`)
      .join('')}
  </div>

  <div class="page">
    <h2>Примітки асистента</h2>
    ${
      report.notes.length
        ? report.notes
            .map(
              (n) =>
                `<div class="bullet"><span class="note-date">${escapeHtml(n.date)}</span><span>${escapeHtml(n.text)}</span></div>`,
            )
            .join('')
        : '<div class="small">Приміток за період немає.</div>'
    }
    ${
      report.comments.length
        ? `<h2>Коментарі до уроків</h2>${report.comments
            .map(
              (cm) =>
                `<div class="bullet"><span class="note-date">${escapeHtml(cm.date)}</span><span class="note-lesson">${escapeHtml(cm.lesson)}</span><span>${escapeHtml(cm.text)}</span></div>`,
            )
            .join('')}`
        : ''
    }
    <div class="small" style="margin-top:14pt">${escapeHtml(METHOD_NOTE)}</div>
  </div>`;

  return htmlDocument(`Аналітичний звіт — ${student.name}`, REPORT_CSS, body);
}
