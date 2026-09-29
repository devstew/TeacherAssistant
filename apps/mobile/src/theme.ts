/**
 * Кольори й розміри ті самі, що у вебі (Tailwind slate + бірюзовий бренд):
 * асистент має впізнавати журнал на телефоні й на комп'ютері.
 */
import { useColorScheme } from 'react-native';

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  subtle: string;
  muted: string;
  line: string;
  ring: string;
  brand: string;
  onBrand: string;
  brandSoft: string;
  brandInk: string;
  danger: string;
  dangerRing: string;
  tones: Record<Tone, { bg: string; fg: string }>;
}

const light: Theme = {
  dark: false,
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  subtle: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  ring: '#cbd5e1',
  brand: '#0f766e',
  onBrand: '#ffffff',
  brandSoft: '#f0fdfa',
  brandInk: '#115e59',
  danger: '#be123c',
  dangerRing: '#fda4af',
  tones: {
    neutral: { bg: '#f1f5f9', fg: '#334155' },
    good: { bg: '#ecfdf5', fg: '#065f46' },
    bad: { bg: '#fff1f2', fg: '#9f1239' },
    warn: { bg: '#fffbeb', fg: '#92400e' },
    info: { bg: '#f0f9ff', fg: '#075985' },
  },
};

const dark: Theme = {
  dark: true,
  bg: '#020617',
  surface: '#0f172a',
  text: '#f1f5f9',
  subtle: '#cbd5e1',
  muted: '#94a3b8',
  line: '#1e293b',
  ring: '#334155',
  brand: '#0d9488',
  onBrand: '#ffffff',
  brandSoft: 'rgba(19, 78, 74, 0.45)',
  brandInk: '#99f6e4',
  danger: '#fda4af',
  dangerRing: '#9f1239',
  tones: {
    neutral: { bg: '#1e293b', fg: '#cbd5e1' },
    good: { bg: '#022c22', fg: '#6ee7b7' },
    bad: { bg: '#4c0519', fg: '#fda4af' },
    warn: { bg: '#451a03', fg: '#fcd34d' },
    info: { bg: '#082f49', fg: '#7dd3fc' },
  },
};

/** Відступи, радіуси й кеглі — щоб не розсипати числа по екранах. */
export const sp = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;
export const font = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22 } as const;
/** Найменша зручна мішень для пальця: бланк заповнюють на ходу, стоячи біля парти. */
export const TAP = 44;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
