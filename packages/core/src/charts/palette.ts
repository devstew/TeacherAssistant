/**
 * Кольори графіків. Перевірена палітра: серії 1–2 розрізняються при
 * дальтонізмі й на світлому, і на темному тлі; шкала частоти — одна гама
 * з монотонною світлотою, щоб «більше» читалося без легенди.
 */
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
  /** Порядкова шкала рівнів допомоги — від найсвітлішого до найтемнішого. */
  ord: [string, string, string, string];
  /** Сім кроків теплової карти і колір тексту на кожному. */
  heat: readonly string[];
  heatInk: readonly string[];
}

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
  heat: ['#e6f0fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'],
  heatInk: ['#0b0b0b', '#0b0b0b', '#0b0b0b', '#0b0b0b', '#ffffff', '#ffffff', '#ffffff'],
};

export const VIZ_DARK: VizColors = {
  surface: '#0f172a',
  ink: '#f1f5f9',
  ink2: '#cbd5e1',
  muted: '#94a3b8',
  grid: '#1e293b',
  axis: '#334155',
  s1: '#3987e5',
  s2: '#d95926',
  spark: '#64748b',
  good: '#4ade80',
  bad: '#fb7185',
  ord: ['#0d366b', '#1c5cab', '#3987e5', '#86b6ef'],
  heat: ['#13233d', '#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#9ec5f4'],
  heatInk: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#0b0b0b', '#0b0b0b'],
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
