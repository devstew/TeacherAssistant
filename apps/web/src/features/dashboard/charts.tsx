import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { endLabelFlags } from '@journal/core';
import { VIZ_VARS, type VizColors } from './vizTheme';

const r = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v)));

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

/** Легенда з ключами-лініями (для ліній) або квадратами (для стовпців). */
export function Legend({ series, kind = 'line', c = VIZ_VARS }: { series: SeriesDef[]; kind?: 'line' | 'rect'; c?: VizColors }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: c.ink2 }}>
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          {kind === 'line' ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          )}
          {s.name}
        </span>
      ))}
    </div>
  );
}

interface TooltipRow {
  name: string;
  value: string;
  color: string;
}

function TooltipBox({ title, rows, c }: { title: ReactNode; rows: TooltipRow[]; c: VizColors }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg ring-1 ring-black/10 dark:ring-white/10"
      style={{ background: c.surface, color: c.ink }}
    >
      <div className="mb-1" style={{ color: c.ink2 }}>
        {title}
      </div>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: row.color }} />
          <span className="font-semibold tabular-nums">{row.value}</span>
          <span style={{ color: c.ink2 }}>{row.name}</span>
        </div>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; payload?: readonly { payload?: Record<string, unknown> }[]; label?: unknown };

function makeTooltip(series: SeriesDef[], c: VizColors, format: (v: number | null, key: string, row: Record<string, unknown>) => string, title?: (row: Record<string, unknown>) => ReactNode) {
  return function Tip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload ?? {};
    return (
      <TooltipBox
        c={c}
        title={title ? title(row) : String(label ?? '')}
        rows={series.map((s) => ({ name: s.name, color: s.color, value: format((row[s.key] as number | null) ?? null, s.key, row) }))}
      />
    );
  };
}

function Frame({ width, height, children }: { width?: number; height: number; children: React.ReactElement }) {
  // Для експорту в PNG потрібні фіксовані розміри без ResponsiveContainer.
  if (width) return children;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

const axisTick = (c: VizColors) => ({ fill: c.muted, fontSize: 12 });

/** Динаміка зведених індексів (0–100) по періодах: одна вісь, 50 — нейтрально. */
export function TrendChart({
  rows,
  series,
  c = VIZ_VARS,
  width,
  height = 280,
  unit = '',
  domain = [0, 100],
}: {
  rows: Record<string, unknown>[];
  series: SeriesDef[];
  c?: VizColors;
  width?: number;
  height?: number;
  unit?: string;
  domain?: [number, number];
}) {
  const lastIdx = (key: string) => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return i;
    return -1;
  };
  // Правило «що підписувати на кінцях» спільне з мобільним застосунком.
  const labelled = endLabelFlags(
    series.map((s) => {
      const i = lastIdx(s.key);
      return i < 0 ? null : (rows[i][s.key] as number);
    }),
  );
  return (
    <Frame width={width} height={height}>
      <LineChart width={width} height={width ? height : undefined} data={rows} margin={{ top: 12, right: 40, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={axisTick(c)} tickLine={false} axisLine={{ stroke: c.axis }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis domain={domain} ticks={[0, 25, 50, 75, 100]} tick={axisTick(c)} tickLine={false} axisLine={false} width={32} />
        <ReferenceLine y={50} stroke={c.axis} />
        {!width && (
          <Tooltip
            cursor={{ stroke: c.axis, strokeWidth: 1 }}
            content={makeTooltip(series, c, (v) => (v == null ? '—' : `${r(v)}${unit}`))}
          />
        )}
        {series.map((s, si) => {
          const last = labelled[si] ? lastIdx(s.key) : -1;
          return (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: s.color, stroke: c.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: s.color, stroke: c.surface, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList
                dataKey={s.key}
                content={(p) => {
                  const { index, x, y, value } = p as { index?: number; x?: number; y?: number; value?: number };
                  if (index !== last || value == null || x == null || y == null) return null;
                  return (
                    <text x={Number(x) + 8} y={Number(y) + 4} fontSize={12} fontWeight={600} fill={c.ink}>
                      {Math.round(value)}
                    </text>
                  );
                }}
              />
            </Line>
          );
        })}
      </LineChart>
    </Frame>
  );
}

/** Горизонтальні смуги одного показника (напр. індекс навчання за предметами). */
export function HBarChart({
  rows,
  name,
  c = VIZ_VARS,
  unit = '',
  max = 100,
  width,
}: {
  rows: { label: string; value: number; n: number }[];
  name: string;
  c?: VizColors;
  unit?: string;
  max?: number;
  width?: number;
}) {
  const height = Math.max(120, rows.length * 32 + 24);
  return (
    <Frame width={width} height={height}>
      <BarChart
        width={width}
        height={width ? height : undefined}
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
        barCategoryGap={8}
      >
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" domain={[0, max]} tick={axisTick(c)} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fill: c.ink2, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axis }} />
        {!width && (
          <Tooltip
            cursor={{ fill: c.grid }}
            content={makeTooltip([{ key: 'value', name, color: c.s1 }], c, (v, _k, row) => `${r(v)}${unit} · ${row.n as number} ур.`)}
          />
        )}
        <Bar dataKey="value" fill={c.s1} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" formatter={(v: unknown) => `${r(v as number)}${unit}`} style={{ fill: c.ink, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/** Стовпці за впорядкованою ознакою (номер уроку). */
export function ColumnChart({
  rows,
  name,
  c = VIZ_VARS,
  unit = '',
  max = 100,
  height = 220,
}: {
  rows: { label: string; value: number | null; n: number }[];
  name: string;
  c?: VizColors;
  unit?: string;
  max?: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={axisTick(c)} tickLine={false} axisLine={{ stroke: c.axis }} />
        <YAxis domain={[0, max]} tick={axisTick(c)} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          cursor={{ fill: c.grid }}
          content={makeTooltip([{ key: 'value', name, color: c.s1 }], c, (v, _k, row) => `${r(v)}${unit} · ${row.n as number} ур.`)}
        />
        <Bar dataKey="value" fill={c.s1} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" formatter={(v: unknown) => (v == null ? '' : `${r(v as number)}${unit}`)} style={{ fill: c.ink, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 100 % стовпці розподілу рівня допомоги (порядкова шкала однієї гами). */
export function StackChart({
  rows,
  series,
  c = VIZ_VARS,
  width,
  height = 240,
}: {
  rows: Record<string, unknown>[];
  series: SeriesDef[];
  c?: VizColors;
  width?: number;
  height?: number;
}) {
  return (
    <Frame width={width} height={height}>
      <BarChart width={width} height={width ? height : undefined} data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={axisTick(c)} tickLine={false} axisLine={{ stroke: c.axis }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={axisTick(c)} tickLine={false} axisLine={false} width={40} />
        {!width && (
          <Tooltip
            cursor={{ fill: c.grid }}
            content={makeTooltip([...series].reverse(), c, (v) => (v == null ? '—' : `${r(v)}%`), (row) => `${row.label as string} · ${row.n as number} ур.`)}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="stack"
            fill={s.color}
            stroke={c.surface}
            strokeWidth={2}
            barSize={24}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  );
}

/** Міні-графік для плитки: сіра лінія, остання точка — акцентом. */
export function Sparkline({ values, c = VIZ_VARS, width = 96, height = 28 }: { values: (number | null)[]; c?: VizColors; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (width - 6);
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline
        points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
        fill="none"
        stroke={c.spark}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(last.i)} cy={y(last.v)} r={4} fill={c.s1} stroke={c.surface} strokeWidth={2} />
    </svg>
  );
}
