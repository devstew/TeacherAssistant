/**
 * Документи як HTML. Телефон перетворює їх на PDF системним друком
 * (`expo-print`), тож усі розміри — у типографських пунктах, як на бланку,
 * а шрифт береться системний: кирилиця в ньому є і на iOS, і на Android.
 */
import type { ReportTable } from '../reportData';

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const INK = '#1f2328';
export const MUTED = '#6b6b66';
export const LINE = '#4b4b48';
export const GREEN = '#dcebd0';
export const BEIGE = '#f3e0d3';

/** Квадратик бланку. Позначку малюємо вектором — символи «галочки» є не в кожному шрифті. */
export const box = (on: boolean): string =>
  `<span class="box${on ? ' on' : ''}">${
    on
      ? '<svg viewBox="0 0 10 10" width="6" height="6"><path d="M1.6 5.3 L4.1 7.7 L8.6 2.5" stroke="#ffffff" stroke-width="1.9" fill="none"/></svg>'
      : ''
  }</span>`;

export const item = (on: boolean, label: string): string =>
  `<div class="item">${box(on)}<span>${escapeHtml(label)}</span></div>`;

export const BASE_CSS = `
  @page { size: A4; margin: 10mm 8mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: ${INK};
    font-family: -apple-system, "Helvetica Neue", "Roboto", "Noto Sans", Arial, sans-serif;
    font-size: 7.4pt;
    line-height: 1.32;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6pt; gap: 8pt; }
  .title { font-size: 11pt; font-weight: 700; }
  .sub { font-size: 7.5pt; color: ${MUTED}; margin-top: 1pt; }
  .date { font-size: 9pt; font-weight: 700; text-align: right; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 0.7pt solid ${LINE}; padding: 3pt; vertical-align: top; text-align: left; }
  th { background: ${GREEN}; font-size: 8pt; font-weight: 700; text-align: center; }
  th.beige { background: ${BEIGE}; }
  .item { display: flex; align-items: flex-start; gap: 3pt; margin-bottom: 1.6pt; }
  .box {
    width: 7pt; height: 7pt; flex: none; margin-top: 1pt;
    border: 0.7pt solid #333333; display: inline-flex; align-items: center; justify-content: center;
  }
  .box.on { background: ${INK}; border-color: ${INK}; }
  .muted { color: ${MUTED}; }
  .bold { font-weight: 700; }
  .sep { border-top: 0.5pt solid #9a9a95; margin: 2.5pt 0; }
  .label { font-weight: 700; margin: 1.5pt 0; }
  .two-col { display: flex; flex-wrap: wrap; }
  .two-col > * { width: 50%; padding-right: 3pt; }
  .row { display: flex; align-items: flex-start; }
`;

export function htmlDocument(title: string, css: string, body: string): string {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${BASE_CSS}${css}</style></head>
<body>${body}</body></html>`;
}

/** Таблиця звіту: перша колонка ширша, решта ділять місце порівну. */
export function tableHtml(t: ReportTable, firstWidth = 34, fontSize = 7.4): string {
  const rest = t.head.length > 1 ? (100 - firstWidth) / (t.head.length - 1) : 0;
  const width = (i: number) => `${i === 0 ? firstWidth : rest}%`;
  const align = (i: number) => (i === 0 ? 'left' : 'center');
  const head = t.head
    .map((h, i) => `<th style="width:${width(i)};text-align:${align(i)}">${escapeHtml(h)}</th>`)
    .join('');
  const rows = t.rows
    .map(
      (r) =>
        `<tr>${r.map((cell, i) => `<td style="text-align:${align(i)}">${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table style="font-size:${fontSize}pt"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
