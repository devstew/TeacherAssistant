import { describe, expect, it } from 'vitest';
import {
  columnLayout,
  endLabelFlags,
  hBarLayout,
  heatBin,
  lineLayout,
  polyline,
  sparklinePoints,
  stackLayout,
} from './index';

const size = { width: 300, height: 120, padding: { left: 30, right: 10, top: 10, bottom: 20 } };

describe('геометрія ліній', () => {
  const rows = [
    { label: 'вер', a: 40, b: 60 },
    { label: 'жов', a: null, b: 50 },
    { label: 'лис', a: 80, b: null },
  ];

  it('розкладає значення від низу до верху шкали', () => {
    const l = lineLayout(rows, ['a'], { ...size, domain: [0, 100] });
    const [first, second] = l.series[0].points;
    expect(first.value).toBe(40);
    expect(second.value).toBe(80);
    // 80 вище за 40, а вісь SVG спрямована вниз.
    expect(second.y).toBeLessThan(first.y);
    expect(first.x).toBeCloseTo(30);
    expect(second.x).toBeCloseTo(290);
  });

  it('пропускає періоди без спостережень, а не малює їх нулем', () => {
    const l = lineLayout(rows, ['a', 'b'], size);
    expect(l.series[0].points.map((p) => p.index)).toEqual([0, 2]);
    expect(l.series[1].points.map((p) => p.index)).toEqual([0, 1]);
    expect(l.series[0].last?.value).toBe(80);
  });

  it('проріджує підписи осі, коли періодів більше, ніж місця', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `т${i + 1}`, a: i }));
    const l = lineLayout(many, ['a'], { ...size, maxXLabels: 4 });
    expect(l.xTicks.length).toBeLessThanOrEqual(5);
    expect(l.xTicks[l.xTicks.length - 1].label).toBe('т12');
  });

  it('дає координату лінії орієнтиру', () => {
    const l = lineLayout(rows, ['a'], { ...size, domain: [0, 100], refValue: 50 });
    expect(l.refY).toBeCloseTo(10 + 90 / 2);
  });
});

describe('геометрія стовпців', () => {
  it('рахує висоту від нуля', () => {
    const l = columnLayout(
      [
        { label: '1', value: 50 },
        { label: '2', value: 100 },
      ],
      { ...size, domain: [0, 100] },
    );
    expect(l.bars[1].height).toBeCloseTo(90);
    expect(l.bars[0].height).toBeCloseTo(45);
    expect(l.bars[0].x).toBeGreaterThanOrEqual(30);
  });

  it('порожнє значення не дає стовпця', () => {
    const l = columnLayout([{ label: '1', value: null }], { ...size, domain: [0, 100] });
    expect(l.bars[0].height).toBe(0);
  });
});

describe('смуги й стеки', () => {
  it('найдовша смуга займає всю ширину', () => {
    const l = hBarLayout(
      [
        { label: 'Математика', value: 80 },
        { label: 'Читання', value: 40 },
      ],
      { width: 200 },
    );
    expect(l.bars[0].width).toBeCloseTo(160);
    expect(l.bars[1].width).toBeCloseTo(80);
    expect(l.bars[1].y).toBeGreaterThan(l.bars[0].y);
  });

  it('стек завжди заповнює стовпець повністю', () => {
    const l = stackLayout([{ label: 'вер', a: 1, b: 3 }], ['a', 'b'], { ...size });
    const total = l.columns[0].segments.reduce((sum, s) => sum + s.height, 0);
    expect(total).toBeCloseTo(l.plot.height);
    expect(l.columns[0].segments[1].height).toBeCloseTo((3 / 4) * l.plot.height);
  });

  it('порожній стовпець не ламає розрахунок', () => {
    const l = stackLayout([{ label: 'вер', a: 0, b: 0 }], ['a', 'b'], { ...size });
    expect(l.columns[0].segments.every((s) => s.height === 0)).toBe(true);
  });
});

describe('мініатюра', () => {
  it('потребує щонайменше двох значень', () => {
    expect(sparklinePoints([50], 40, 16)).toEqual([]);
    expect(sparklinePoints([50, null, 60], 40, 16)).toHaveLength(2);
  });

  it('однакові значення дають рівну лінію', () => {
    const points = sparklinePoints([50, 50, 50], 40, 16);
    expect(new Set(points.map((p) => Math.round(p.y))).size).toBe(1);
  });

  it('перетворюється на шлях SVG', () => {
    expect(polyline([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('M0.0 1.0 L2.0 3.0');
    expect(polyline([])).toBe('');
  });
});

describe('підписи на кінцях ліній', () => {
  it('підписує обидві лінії, коли вони далеко одна від одної', () => {
    expect(endLabelFlags([56, 30])).toEqual([true, true]);
  });

  it('не підписує жодної, коли лінії майже зійшлися', () => {
    expect(endLabelFlags([56, 54])).toEqual([false, false]);
  });

  it('однакові значення підписує один раз', () => {
    expect(endLabelFlags([50, 50])).toEqual([true, false]);
  });

  it('порожню лінію не підписує, але сусідній не заважає', () => {
    expect(endLabelFlags([null, 40])).toEqual([false, true]);
  });
});

describe('шкала частоти', () => {
  it('росте разом із відсотком і не виходить за межі', () => {
    expect(heatBin(0)).toBe(0);
    expect(heatBin(100)).toBe(6);
    const bins = [0, 10, 20, 40, 50, 70, 90].map(heatBin);
    expect(bins).toEqual([...bins].sort((a, b) => a - b));
  });
});
