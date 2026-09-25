/** Кольори графіків: CSS-змінні для застосунку, hex — для PNG у звітах. */
export interface VizColors {
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  s1: string;
  s2: string;
  spark: string;
  good: string;
  bad: string;
  ord: [string, string, string, string];
}

export const VIZ_VARS: VizColors = {
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
  ord: ['var(--viz-ord-0)', 'var(--viz-ord-1)', 'var(--viz-ord-2)', 'var(--viz-ord-3)'],
};

/** Світла тема в hex — для графіків, які перетворюються на PNG для PDF/DOCX. */
export const VIZ_LIGHT: VizColors = {
  surface: '#ffffff',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#ecebe6',
  axis: '#c3c2b7',
  s1: '#2a78d6',
  s2: '#eb6834',
  spark: '#b4b2aa',
  good: '#006300',
  bad: '#d03b3b',
  ord: ['#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
};

/** Сім кроків послідовної шкали для частоти 0–100 %. */
export function heatBin(pct: number): number {
  if (pct < 5) return 0;
  if (pct < 15) return 1;
  if (pct < 30) return 2;
  if (pct < 45) return 3;
  if (pct < 60) return 4;
  if (pct < 80) return 5;
  return 6;
}
