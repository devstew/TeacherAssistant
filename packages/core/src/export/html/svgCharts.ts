/**
 * Графіки для документів — рядок SVG із тієї самої геометрії, що й на екрані.
 * Саме рядок, а не картинка: у PDF він лишається різким за будь-якого масштабу,
 * а WKWebView на iOS не бачить локальних файлів, тож вставляти PNG нізвідки.
 */
import { VIZ_LIGHT } from '../../charts/palette';
import { endLabelFlags, lineLayout, polyline, stackLayout, type ChartRow } from '../../charts/geometry';
import { escapeHtml } from './kit';

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
}

const c = VIZ_LIGHT;

export function legendHtml(series: ChartSeries[], kind: 'line' | 'rect' = 'line'): string {
  const mark = (color: string) =>
    kind === 'line'
      ? `<span style="display:inline-block;width:12pt;height:2pt;background:${color};margin-right:3pt"></span>`
      : `<span style="display:inline-block;width:7pt;height:7pt;background:${color};margin-right:3pt"></span>`;
  return `<div style="display:flex;flex-wrap:wrap;gap:10pt;margin-bottom:3pt;font-size:7.5pt">
    ${series.map((s) => `<span style="display:flex;align-items:center">${mark(s.color)}${escapeHtml(s.name)}</span>`).join('')}
  </div>`;
}

/** Динаміка індексів 0–100 по періодах; пунктир 50 — нейтрально. */
export function trendSvg(rows: ChartRow[], series: ChartSeries[], width = 520, height = 190): string {
  const l = lineLayout(
    rows,
    series.map((s) => s.key),
    { width, height, domain: [0, 100], refValue: 50, tickCount: 5, maxXLabels: Math.floor(width / 48) },
  );
  const labelled = endLabelFlags(l.series.map((s) => s.last?.value ?? null));

  const grid = l.yTicks
    .map(
      (t) =>
        `<line x1="${l.plot.left}" y1="${t.pos}" x2="${l.plot.left + l.plot.width}" y2="${t.pos}" stroke="${c.grid}" stroke-width="1"/>` +
        `<text x="${l.plot.left - 5}" y="${t.pos + 3}" fill="${c.muted}" font-size="8" text-anchor="end">${t.label}</text>`,
    )
    .join('');
  const ref =
    l.refY == null
      ? ''
      : `<line x1="${l.plot.left}" y1="${l.refY}" x2="${l.plot.left + l.plot.width}" y2="${l.refY}" stroke="${c.axis}" stroke-width="1" stroke-dasharray="4 4"/>`;
  const xLabels = l.xTicks
    .map((t) => `<text x="${t.x}" y="${height - 4}" fill="${c.muted}" font-size="8" text-anchor="middle">${escapeHtml(t.label)}</text>`)
    .join('');
  const lines = l.series
    .map((s, i) => {
      const dots = s.points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.2" fill="${series[i].color}"/>`).join('');
      const end =
        s.last && labelled[i]
          ? `<text x="${s.last.x}" y="${s.last.y - 6}" fill="${series[i].color}" font-size="9" font-weight="600" text-anchor="end">${Math.round(s.last.value)}</text>`
          : '';
      return `<path d="${polyline(s.points)}" stroke="${series[i].color}" stroke-width="1.8" fill="none"/>${dots}${end}`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${grid}${ref}${xLabels}${lines}</svg>`;
}

/** Стовпці на 100 %: розподіл уроків за рівнем допомоги асистента. */
export function stackSvg(rows: ChartRow[], series: ChartSeries[], width = 520, height = 170): string {
  const l = stackLayout(
    rows,
    series.map((s) => s.key),
    { width, height },
  );
  const columns = l.columns
    .map(
      (col) =>
        col.segments
          .map(
            (seg, i) =>
              `<rect x="${col.x}" y="${seg.y}" width="${col.width}" height="${seg.height}" fill="${series[i].color}"/>`,
          )
          .join('') +
        `<text x="${col.x + col.width / 2}" y="${height - 4}" fill="${c.muted}" font-size="8" text-anchor="middle">${escapeHtml(col.label)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${columns}</svg>`;
}
