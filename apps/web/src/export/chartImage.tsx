/**
 * Перетворює графік Recharts на PNG для PDF/DOCX: малюємо той самий компонент,
 * що й на дашборді (у світлих hex-кольорах), поза екраном і растеризуємо SVG.
 */
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { HELP_LEVELS } from '@journal/core';
import type { Analysis } from '@journal/core';
import { MONTHS_SHORT, monthIndex } from '@journal/core';
import { StackChart, TrendChart, type SeriesDef } from '../features/dashboard/charts';
import { VIZ_LIGHT } from '../features/dashboard/vizTheme';

export interface ChartImage {
  dataUrl: string;
  width: number;
  height: number;
  legend: SeriesDef[];
  legendKind: 'line' | 'rect';
}

/**
 * Поступитися чергою, щоб React/Recharts доробили відкладені ефекти. MessageChannel,
 * а не таймери чи requestAnimationFrame: у фоновій вкладці ті пригальмовуються до
 * разу на секунду (або й на хвилину), і експорт «зависав» би.
 */
const yieldTask = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не вдалося растеризувати графік'));
    img.src = src;
  });
}

export async function renderChartPng(node: ReactElement, width: number, height: number, scale = 2): Promise<string> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;background:#fff;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(node));
    // Recharts домальовує осі й підписи в кілька проходів — чекаємо на готовий SVG.
    for (let i = 0; i < 200 && !host.querySelector('.recharts-line-curve, .recharts-bar-rectangle'); i++) await yieldTask();
    for (let i = 0; i < 5; i++) await yieldTask();
    const svg = host.querySelector('svg.recharts-surface') as SVGSVGElement | null;
    if (!svg) throw new Error('Не вдалося намалювати графік');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = "text{font-family:'Noto Sans',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}";
    clone.insertBefore(style, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Графіки для аналітичного звіту: динаміка індексів і розподіл допомоги. */
export async function reportCharts(a: Analysis): Promise<ChartImage[]> {
  const buckets = a.buckets.filter((b) => b.observed > 0 || b.observedDays > 0);
  const label = (key: string) => MONTHS_SHORT[monthIndex(key)];
  const out: ChartImage[] = [];

  const trendSeries: SeriesDef[] = [
    { key: 'learningIndex', name: 'Індекс навчання', color: VIZ_LIGHT.s1 },
    { key: 'behaviorIndex', name: 'Індекс поведінки', color: VIZ_LIGHT.s2 },
  ];
  const trendRows = buckets.map((b) => ({
    label: label(b.key),
    learningIndex: b.metrics.learningIndex.value,
    behaviorIndex: b.metrics.behaviorIndex.value,
  }));
  if (trendRows.length) {
    out.push({
      dataUrl: await renderChartPng(<TrendChart rows={trendRows} series={trendSeries} c={VIZ_LIGHT} width={720} height={280} />, 720, 280),
      width: 720,
      height: 280,
      legend: trendSeries,
      legendKind: 'line',
    });
  }

  const helpSeries: SeriesDef[] = HELP_LEVELS.map((h, i) => ({ key: h.id, name: h.label, color: VIZ_LIGHT.ord[i] }));
  const helpRows = buckets
    .filter((b) => b.help.n > 0)
    .map((b) => ({ label: label(b.key), n: b.help.n, ...Object.fromEntries(HELP_LEVELS.map((h) => [h.id, (100 * b.help[h.id]) / b.help.n])) }));
  if (helpRows.length) {
    out.push({
      dataUrl: await renderChartPng(<StackChart rows={helpRows} series={helpSeries} c={VIZ_LIGHT} width={720} height={240} />, 720, 240),
      width: 720,
      height: 240,
      legend: helpSeries,
      legendKind: 'rect',
    });
  }
  return out;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
