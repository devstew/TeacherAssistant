/**
 * Графіки телефона. Уся математика — у ядрі (`@journal/core/charts`),
 * тут лише малювання; завдяки цьому цифри на екрані й у звіті збігаються.
 */
import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  VIZ_DARK,
  VIZ_LIGHT,
  columnLayout,
  endLabelFlags,
  hBarLayout,
  lineLayout,
  polyline,
  sparklinePoints,
  stackLayout,
  type ChartRow,
  type VizColors,
} from '@journal/core';
import { font, sp, useTheme } from '@/theme';

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

export function useViz(): VizColors {
  return useTheme().dark ? VIZ_DARK : VIZ_LIGHT;
}

/** Ширину графіка знає лише пристрій, тому вимірюємо контейнер. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

export function Legend({ series, kind = 'line' }: { series: SeriesDef[]; kind?: 'line' | 'rect' }) {
  const c = useViz();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.md }}>
      {series.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: kind === 'line' ? 16 : 10,
              height: kind === 'line' ? 2 : 10,
              borderRadius: kind === 'line' ? 1 : 2,
              backgroundColor: s.color,
            }}
          />
          <Text style={{ color: c.ink2, fontSize: font.xs }}>{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

export function Sparkline({ values, width = 64, height = 22 }: { values: (number | null | undefined)[]; width?: number; height?: number }) {
  const c = useViz();
  const points = sparklinePoints(values, width, height);
  if (points.length < 2) return <View style={{ width, height }} />;
  return (
    <Svg width={width} height={height}>
      <Path d={polyline(points)} stroke={c.spark} strokeWidth={1.5} fill="none" />
      <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2} fill={c.spark} />
    </Svg>
  );
}

/** Динаміка індексів 0–100 по періодах; 50 — нейтрально. */
export function TrendChart({
  rows,
  series,
  height = 180,
  unit = '',
  domain = [0, 100],
  refValue = 50,
}: {
  rows: ChartRow[];
  series: SeriesDef[];
  height?: number;
  unit?: string;
  domain?: [number, number];
  refValue?: number;
}) {
  const c = useViz();
  const [width, onLayout] = useWidth();

  return (
    <View onLayout={onLayout}>
      {width > 0 && (() => {
        const l = lineLayout(rows, series.map((s) => s.key), {
          width,
          height,
          domain,
          refValue,
          // Один підпис займає близько 34 пунктів ширини.
          maxXLabels: Math.max(2, Math.floor(width / 42)),
        });
        const labelled = endLabelFlags(l.series.map((s) => s.last?.value ?? null));
        return (
          <Svg width={width} height={height}>
            {l.yTicks.map((t) => (
              <G key={t.value}>
                <Line x1={l.plot.left} y1={t.pos} x2={l.plot.left + l.plot.width} y2={t.pos} stroke={c.grid} strokeWidth={1} />
                <SvgText x={l.plot.left - 6} y={t.pos + 4} fill={c.muted} fontSize={10} textAnchor="end">
                  {t.label}
                </SvgText>
              </G>
            ))}
            {l.refY != null && (
              <Line
                x1={l.plot.left}
                y1={l.refY}
                x2={l.plot.left + l.plot.width}
                y2={l.refY}
                stroke={c.axis}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            {l.xTicks.map((t) => (
              <SvgText key={t.index} x={t.x} y={height - 6} fill={c.muted} fontSize={10} textAnchor="middle">
                {t.label}
              </SvgText>
            ))}
            {l.series.map((s, i) => (
              <G key={s.key}>
                <Path d={polyline(s.points)} stroke={series[i].color} strokeWidth={2} fill="none" />
                {s.points.map((p) => (
                  <Circle key={p.index} cx={p.x} cy={p.y} r={2.5} fill={series[i].color} />
                ))}
                {s.last && labelled[i] && (
                  <SvgText
                    x={Math.min(s.last.x, l.plot.left + l.plot.width - 2)}
                    y={s.last.y - 7}
                    fill={series[i].color}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="end"
                  >
                    {`${Math.round(s.last.value)}${unit}`}
                  </SvgText>
                )}
              </G>
            ))}
          </Svg>
        );
      })()}
    </View>
  );
}

export function ColumnChart({
  rows,
  height = 170,
  unit = '',
  domain,
}: {
  rows: { label: string; value: number | null }[];
  height?: number;
  unit?: string;
  domain?: [number, number];
}) {
  const c = useViz();
  const [width, onLayout] = useWidth();

  return (
    <View onLayout={onLayout}>
      {width > 0 && (() => {
        const l = columnLayout(rows, { width, height, domain: domain ?? [0, 100] });
        return (
          <Svg width={width} height={height}>
            {l.yTicks.map((t) => (
              <G key={t.value}>
                <Line x1={l.plot.left} y1={t.pos} x2={l.plot.left + l.plot.width} y2={t.pos} stroke={c.grid} strokeWidth={1} />
                <SvgText x={l.plot.left - 6} y={t.pos + 4} fill={c.muted} fontSize={10} textAnchor="end">
                  {t.label}
                </SvgText>
              </G>
            ))}
            {l.bars.map((b) => (
              <G key={b.index}>
                <Rect x={b.x} y={b.y} width={b.width} height={b.height} rx={2} fill={c.s1} />
                {b.value != null && (
                  <SvgText x={b.x + b.width / 2} y={b.y - 4} fill={c.ink2} fontSize={10} textAnchor="middle">
                    {`${Math.round(b.value)}${unit}`}
                  </SvgText>
                )}
                <SvgText x={b.x + b.width / 2} y={height - 6} fill={c.muted} fontSize={10} textAnchor="middle">
                  {b.label}
                </SvgText>
              </G>
            ))}
          </Svg>
        );
      })()}
    </View>
  );
}

/** Горизонтальні смуги — коли підпис довший за саме значення (предмети). */
export function HBarChart({ rows, unit = '' }: { rows: { label: string; value: number }[]; unit?: string }) {
  const c = useViz();
  const [width, onLayout] = useWidth();
  const rowHeight = 20;
  const gap = 22; // місце під підпис над смугою

  return (
    <View onLayout={onLayout}>
      {width > 0 && (() => {
        const l = hBarLayout(rows, { width, rowHeight, gap });
        const height = rows.length * (rowHeight + gap);
        return (
          <Svg width={width} height={height}>
            {l.bars.map((b) => (
              <G key={b.index}>
                <SvgText x={0} y={b.y - 6} fill={c.ink2} fontSize={11}>
                  {b.label}
                </SvgText>
                <Rect x={b.x} y={b.y} width={b.width} height={b.height} rx={3} fill={c.s1} />
                <SvgText x={b.x + b.width + 6} y={b.y + rowHeight / 2 + 4} fill={c.ink2} fontSize={11} fontWeight="600">
                  {`${Math.round(b.value)}${unit}`}
                </SvgText>
              </G>
            ))}
          </Svg>
        );
      })()}
    </View>
  );
}

/** Стовпці на 100 %: розподіл уроків за рівнем допомоги асистента. */
export function StackChart({ rows, series, height = 170 }: { rows: ChartRow[]; series: SeriesDef[]; height?: number }) {
  const c = useViz();
  const [width, onLayout] = useWidth();

  return (
    <View onLayout={onLayout}>
      {width > 0 && (() => {
        const l = stackLayout(rows, series.map((s) => s.key), { width, height });
        return (
          <Svg width={width} height={height}>
            {l.columns.map((col) => (
              <G key={col.index}>
                {col.segments.map((seg, i) => (
                  <Rect key={seg.key} x={col.x} y={seg.y} width={col.width} height={seg.height} fill={series[i].color} />
                ))}
                <SvgText x={col.x + col.width / 2} y={height - 6} fill={c.muted} fontSize={10} textAnchor="middle">
                  {col.label}
                </SvgText>
              </G>
            ))}
          </Svg>
        );
      })()}
    </View>
  );
}
