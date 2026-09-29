/**
 * Час і дата без системного пікера: три списки замість календаря.
 * Дзвінки та канікули вносять кілька разів на рік, зате однаково на обох
 * платформах — і в перегляді з браузера теж.
 */
import { View } from 'react-native';
import { MONTHS_NOM } from '@journal/core';
import { Select } from './ui';
import { sp } from '@/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const range = (from: number, to: number, step = 1) => {
  const out: number[] = [];
  for (let i = from; i <= to; i += step) out.push(i);
  return out;
};

const HOURS = range(6, 20).map((h) => ({ id: pad(h), label: pad(h) }));
const MINUTES = range(0, 55, 5).map((m) => ({ id: pad(m), label: pad(m) }));

export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [h = '08', m = '00'] = value.split(':');
  // Хвилини поза кроком у п'ять (07:43) не губляться: додаємо їх у список.
  const minutes = MINUTES.some((x) => x.id === m) ? MINUTES : [...MINUTES, { id: m, label: m }].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <View style={{ flexDirection: 'row', gap: sp.sm }}>
      <View style={{ flex: 1 }}>
        <Select label={label ? `${label}: година` : 'Година'} value={h} options={HOURS} onChange={(v) => onChange(`${v}:${m}`)} />
      </View>
      <View style={{ flex: 1 }}>
        <Select label={label ? `${label}: хвилини` : 'Хвилини'} value={m} options={minutes} onChange={(v) => onChange(`${h}:${v}`)} />
      </View>
    </View>
  );
}

const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

export function DateField({
  value,
  onChange,
  years,
  label,
}: {
  /** ISO, наприклад 2026-10-26. Порожній рядок — дата ще не вибрана. */
  value: string;
  onChange: (v: string) => void;
  years: number[];
  label?: string;
}) {
  const today = new Date();
  const [y = years[0] ?? today.getFullYear(), m = today.getMonth() + 1, d = 1] = value
    ? value.split('-').map(Number)
    : [];
  const set = (year: number, month: number, day: number) =>
    onChange(`${year}-${pad(month)}-${pad(Math.min(day, daysIn(year, month)))}`);

  return (
    <View style={{ flexDirection: 'row', gap: sp.sm }}>
      <View style={{ flex: 1 }}>
        <Select
          label={label ? `${label}: день` : 'День'}
          value={String(d)}
          options={range(1, daysIn(y, m)).map((x) => ({ id: String(x), label: String(x) }))}
          onChange={(v) => set(y, m, Number(v))}
        />
      </View>
      <View style={{ flex: 2 }}>
        <Select
          label={label ? `${label}: місяць` : 'Місяць'}
          value={String(m)}
          options={MONTHS_NOM.map((name, i) => ({ id: String(i + 1), label: name }))}
          onChange={(v) => set(y, Number(v), d)}
        />
      </View>
      <View style={{ flex: 1.2 }}>
        <Select
          label={label ? `${label}: рік` : 'Рік'}
          value={String(y)}
          options={years.map((x) => ({ id: String(x), label: String(x) }))}
          onChange={(v) => set(Number(v), m, d)}
        />
      </View>
    </View>
  );
}
