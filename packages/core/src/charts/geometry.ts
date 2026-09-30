/**
 * Геометрія графіків без жодного малювання: на вхід — рядки з числами,
 * на вихід — координати. Малює їх кожна платформа своїм способом
 * (SVG на телефоні, Recharts у вебі, рядок SVG в експорті), але розрахунок
 * один — інакше той самий показник виглядав би по-різному в застосунку
 * і в документі для школи.
 *
 * Вісь Y тут спрямована вниз, як в SVG: y = 0 — верх області графіка.
 */

export interface Plot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Padding {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface ChartOptions {
  width: number;
  height: number;
  padding?: Padding;
  /** Межі шкали значень. Для індексів це [0, 100]. */
  domain?: [number, number];
  /** Скільки поділок підписати на осі значень. */
  tickCount?: number;
}

export interface Tick {
  value: number;
  /** Координата в системі графіка. */
  pos: number;
  label: string;
}

export interface LinePoint {
  index: number;
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface LineSeriesLayout {
  key: string;
  points: LinePoint[];
  /** Остання точка з даними — біля неї підписують значення. */
  last?: LinePoint;
}

export interface LineLayout {
  plot: Plot;
  series: LineSeriesLayout[];
  xTicks: { index: number; x: number; label: string }[];
  yTicks: Tick[];
  /** Лінія орієнтиру (для індексів — 50, «нейтрально»). */
  refY?: number;
}

/** Рядок даних графіка: підпис періоду плюс значення серій. */
export interface ChartRow {
  label: string;
  [key: string]: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function plotOf(o: ChartOptions, fallback: Required<Padding>): Plot {
  const p = { ...fallback, ...o.padding };
  return {
    left: p.left,
    top: p.top,
    width: Math.max(1, o.width - p.left - p.right),
    height: Math.max(1, o.height - p.top - p.bottom),
  };
}

/** Рівні поділки з приємними числами. */
export function ticksOf(domain: [number, number], count: number): number[] {
  const [min, max] = domain;
  if (count <= 1 || max <= min) return [min, max];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

const scaleY = (value: number, [min, max]: [number, number], plot: Plot): number =>
  plot.top + plot.height - ((value - min) / (max - min || 1)) * plot.height;

/**
 * Лінії по періодах. Точки розставлені рівномірно; пропуски (null) просто
 * відсутні — лінія має рватися там, де спостережень не було, а не падати в нуль.
 */
export function lineLayout(
  rows: ChartRow[],
  keys: string[],
  o: ChartOptions & { refValue?: number; maxXLabels?: number },
): LineLayout {
  const plot = plotOf(o, { left: 34, right: 12, top: 10, bottom: 24 });
  const domain = o.domain ?? [0, 100];
  const n = rows.length;
  const xOf = (i: number) => plot.left + (n <= 1 ? plot.width / 2 : (i / (n - 1)) * plot.width);

  const series = keys.map((key) => {
    const points: LinePoint[] = [];
    rows.forEach((row, i) => {
      const value = num(row[key]);
      if (value == null) return;
      points.push({ index: i, x: xOf(i), y: scaleY(value, domain, plot), value, label: row.label });
    });
    return { key, points, last: points[points.length - 1] };
  });

  // На вузькому екрані підписи осі X злипаються — показуємо кожен k-й.
  const maxLabels = o.maxXLabels ?? n;
  const step = Math.max(1, Math.ceil(n / Math.max(1, maxLabels)));
  const xTicks = rows
    .map((row, i) => ({ index: i, x: xOf(i), label: row.label }))
    .filter((_, i) => i % step === 0 || i === n - 1);

  return {
    plot,
    series,
    xTicks,
    yTicks: ticksOf(domain, o.tickCount ?? 3).map((value) => ({
      value,
      pos: scaleY(value, domain, plot),
      label: String(Math.round(value)),
    })),
    refY: o.refValue == null ? undefined : scaleY(o.refValue, domain, plot),
  };
}

export interface Bar {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number | null;
  label: string;
}

export interface ColumnLayout {
  plot: Plot;
  bars: Bar[];
  yTicks: Tick[];
}

/** Вертикальні стовпці: значення за номером уроку, за предметом тощо. */
export function columnLayout(
  rows: { label: string; value: number | null }[],
  o: ChartOptions & { gap?: number },
): ColumnLayout {
  const plot = plotOf(o, { left: 34, right: 8, top: 10, bottom: 24 });
  const domain = o.domain ?? [0, Math.max(1, ...rows.map((r) => r.value ?? 0))];
  const slot = plot.width / Math.max(1, rows.length);
  const gap = o.gap ?? Math.min(12, slot * 0.25);
  const width = Math.max(2, slot - gap);
  const base = scaleY(Math.max(domain[0], 0), domain, plot);

  return {
    plot,
    bars: rows.map((row, index) => {
      const y = row.value == null ? base : scaleY(row.value, domain, plot);
      return {
        index,
        x: plot.left + index * slot + (slot - width) / 2,
        y,
        width,
        height: Math.max(row.value == null ? 0 : 1, base - y),
        value: row.value,
        label: row.label,
      };
    }),
    yTicks: ticksOf(domain, o.tickCount ?? 3).map((value) => ({
      value,
      pos: scaleY(value, domain, plot),
      label: String(Math.round(value)),
    })),
  };
}

export interface HBar {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  label: string;
}

export interface HBarLayout {
  plot: Plot;
  bars: HBar[];
  max: number;
}

/**
 * Горизонтальні смуги — коли підпис довгий (назва предмета). Висота графіка
 * визначається кількістю рядків, а не навпаки.
 */
export function hBarLayout(
  rows: { label: string; value: number }[],
  o: Omit<ChartOptions, 'height'> & { rowHeight?: number; gap?: number },
): HBarLayout {
  const rowHeight = o.rowHeight ?? 22;
  const gap = o.gap ?? 6;
  const height = rows.length * (rowHeight + gap);
  const plot = plotOf({ ...o, height }, { left: 0, right: 40, top: 0, bottom: 0 });
  const max = o.domain?.[1] ?? Math.max(1, ...rows.map((r) => r.value));

  return {
    plot,
    max,
    bars: rows.map((row, index) => ({
      index,
      x: plot.left,
      y: plot.top + index * (rowHeight + gap),
      width: Math.max(1, (Math.max(0, row.value) / max) * plot.width),
      height: rowHeight,
      value: row.value,
      label: row.label,
    })),
  };
}

export interface StackSegment {
  key: string;
  y: number;
  height: number;
  value: number;
}

export interface StackColumn {
  index: number;
  x: number;
  width: number;
  label: string;
  segments: StackSegment[];
}

export interface StackLayout {
  plot: Plot;
  columns: StackColumn[];
}

/**
 * Стовпці на 100 %: розподіл уроків за рівнем допомоги. Частки нормуються,
 * тож стовпці різної наповненості порівнюються між собою.
 */
export function stackLayout(rows: ChartRow[], keys: string[], o: ChartOptions & { gap?: number }): StackLayout {
  const plot = plotOf(o, { left: 0, right: 0, top: 6, bottom: 24 });
  const slot = plot.width / Math.max(1, rows.length);
  const gap = o.gap ?? Math.min(14, slot * 0.3);
  const width = Math.max(2, slot - gap);

  return {
    plot,
    columns: rows.map((row, index) => {
      const values = keys.map((key) => Math.max(0, num(row[key]) ?? 0));
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let y = plot.top;
      const segments = keys.map((key, i) => {
        const height = (values[i] / total) * plot.height;
        const seg = { key, y, height, value: values[i] };
        y += height;
        return seg;
      });
      return { index, x: plot.left + index * slot + (slot - width) / 2, width, label: row.label, segments };
    }),
  };
}

/** Мініатюрна лінія в плитці показника: лише форма, без осей. */
export function sparklinePoints(
  values: (number | null | undefined)[],
  width: number,
  height: number,
  domain?: [number, number],
): { x: number; y: number }[] {
  const present = values.map(num);
  const known = present.filter((v): v is number => v != null);
  if (known.length < 2) return [];
  const [min, max] = domain ?? [Math.min(...known), Math.max(...known)];
  const span = max - min || 1;
  const plot: Plot = { left: 1, top: 1, width: Math.max(1, width - 2), height: Math.max(1, height - 2) };
  return present.flatMap((v, i) =>
    v == null
      ? []
      : [
          {
            x: plot.left + (i / (present.length - 1)) * plot.width,
            y: scaleY(v, [min, max + (span === 0 ? 1 : 0)], plot),
          },
        ],
  );
}

/**
 * Які кінцеві точки ліній підписувати цифрою. Коли лінії сходяться, підписи
 * накладаються й перетворюються на кашу, тож однакові значення підписуємо один
 * раз, а просто близькі — не підписуємо зовсім: число є в таблиці й у плитці.
 */
export function endLabelFlags(values: (number | null | undefined)[], minGap = 6): boolean[] {
  const ends = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null));
  return ends.map(
    (value, i) =>
      value != null &&
      ends.every((other, j) => j === i || other == null || Math.abs(other - value) >= minGap || (other === value && j > i)),
  );
}

/** Ламана для SVG: «M x y L x y …». Порожній масив дає порожній рядок. */
export const polyline = (points: { x: number; y: number }[]): string =>
  points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
