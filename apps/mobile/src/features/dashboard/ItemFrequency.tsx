import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CATEGORIES,
  fmtDelta,
  heatBin,
  resolveItem,
  type Bucket,
  type CategoryId,
  type Settings,
} from '@journal/core';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Sparkline, useViz } from '@/components/charts';
import { TAP, font, radius, sp, useTheme } from '@/theme';

const SIGN = { 1: '+', [-1]: '−', 0: '·' } as const;

/**
 * Частота кожного пункту бланку. Таблиця «пункти × періоди» з вебу на телефон
 * не вміщається, тому для кожного пункту показуємо те саме трьома величинами:
 * хід за періодами (мініатюра), частота в поточному періоді (колір шкали)
 * і зміна відносно попереднього. Категорії згорнуті: шістдесят пунктів одним
 * списком на телефоні гортати нікому не хочеться.
 */
export function ItemFrequency({
  buckets,
  settings,
  current,
  previous,
  categories,
}: {
  buckets: Bucket[];
  settings: Settings;
  current?: Bucket;
  previous?: Bucket;
  categories: CategoryId[];
}) {
  const t = useTheme();
  const c = useViz();
  const [open, setOpen] = useState<string | null>(null);
  const shown = buckets.filter((b) => b.observed > 0 || b.observedDays > 0);

  return (
    <View style={{ gap: sp.sm }}>
      {CATEGORIES.filter((cat) => categories.includes(cat.id)).map((cat) => (
        <View key={cat.id} style={{ gap: sp.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === cat.id }}
            onPress={() => setOpen((v) => (v === cat.id ? null : cat.id))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm, minHeight: TAP }}
          >
            {open === cat.id ? <ChevronDown color={t.muted} size={16} /> : <ChevronRight color={t.muted} size={16} />}
            <Text style={{ color: t.text, fontSize: font.sm, fontWeight: '700', flex: 1 }}>{cat.title}</Text>
            <Text style={{ color: t.muted, fontSize: font.xs }}>{cat.items.length}</Text>
          </Pressable>
          {open === cat.id &&
            cat.items.map((item) => {
            const pol = resolveItem(item, settings).polarity;
            const cur = current?.itemFreq[item.id];
            const prev = previous?.itemFreq[item.id];
            const d = cur?.pct != null && prev?.pct != null ? cur.pct - prev.pct : null;
            // Для негативних пунктів зменшення частоти — покращення.
            const good = d != null && pol !== 0 && Math.abs(d) >= 5 ? pol * d > 0 : null;
            const bin = cur?.pct == null ? null : heatBin(cur.pct);

            return (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                <Text style={{ color: t.muted, fontSize: font.xs, width: 10 }}>{SIGN[pol]}</Text>
                <Text style={{ color: t.subtle, fontSize: font.sm, flex: 1 }} numberOfLines={2}>
                  {item.label}
                </Text>
                <Sparkline values={shown.map((b) => b.itemFreq[item.id]?.pct ?? null)} width={44} height={16} />
                <View
                  style={{
                    minWidth: 34,
                    alignItems: 'center',
                    paddingVertical: 2,
                    borderRadius: radius.sm,
                    backgroundColor: bin == null ? 'transparent' : c.heat[bin],
                  }}
                >
                  <Text
                    style={{
                      color: bin == null ? t.muted : c.heatInk[bin],
                      fontSize: font.xs,
                      fontWeight: '600',
                    }}
                  >
                    {cur?.pct == null ? '—' : Math.round(cur.pct)}
                  </Text>
                </View>
                <Text
                  style={{
                    width: 46,
                    textAlign: 'right',
                    fontSize: font.xs,
                    fontWeight: '600',
                    color: good == null ? t.muted : good ? c.good : c.bad,
                  }}
                >
                  {d == null ? '—' : `${Math.round(d) > 0 ? '▲' : Math.round(d) < 0 ? '▼' : ''}${fmtDelta(d)}`}
                </Text>
              </View>
              );
            })}
        </View>
      ))}
    </View>
  );
}
