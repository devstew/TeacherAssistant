/** Кольори графіків: CSS-змінні для застосунку, hex (з ядра) — для PNG у звітах. */
export type { VizColors } from '@journal/core';

export const VIZ_VARS = {
  surface: 'var(--viz-surface)',
  ink: 'var(--viz-ink)',
  ink2: 'var(--viz-ink-2)',
  muted: 'var(--viz-muted)',
  grid: 'var(--viz-grid)',
  axis: 'var(--viz-axis)',
  s1: 'var(--viz-s1)',
  s2: 'var(--viz-s2)',
  spark: 'var(--viz-spark)',
  good: 'var(--viz-good)',
  bad: 'var(--viz-bad)',
  ord: ['var(--viz-ord-0)', 'var(--viz-ord-1)', 'var(--viz-ord-2)', 'var(--viz-ord-3)'] as [string, string, string, string],
  heat: Array.from({ length: 7 }, (_, i) => `var(--heat-${i})`),
  heatInk: Array.from({ length: 7 }, (_, i) => `var(--heat-ink-${i})`),
};

/** Палітра для PNG у звітах і шкала частоти — спільні з мобільним застосунком. */
export { VIZ_LIGHT, heatBin } from '@journal/core';
