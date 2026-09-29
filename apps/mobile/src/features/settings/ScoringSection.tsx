import { Alert, Text, View } from 'react-native';
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  HELP_LEVELS,
  getSettings,
  saveSettings,
  useRepo,
  type Polarity,
  type Settings,
} from '@journal/core';
import { Button, Card, Field, Input, Notice, Segmented } from '@/components/ui';
import { font, sp, useTheme } from '@/theme';

const POLARITY: { id: string; label: string }[] = [
  { id: '1', label: '+' },
  { id: '0', label: '0' },
  { id: '-1', label: '−' },
];

export function ScoringSection() {
  const t = useTheme();
  const settings = useRepo(getSettings);
  if (!settings) return null;

  const update = (next: Partial<Settings>) => saveSettings({ ...settings, ...next });
  const setOverride = (
    id: string,
    patch: { polarity?: Polarity; weight?: number },
    def: { polarity: Polarity; weight: number },
  ) => {
    const merged = { ...settings.itemOverrides[id], ...patch };
    const clean: typeof merged = {};
    if (merged.polarity != null && merged.polarity !== def.polarity) clean.polarity = merged.polarity;
    if (merged.weight != null && merged.weight !== def.weight) clean.weight = merged.weight;
    const itemOverrides = { ...settings.itemOverrides };
    if (Object.keys(clean).length) itemOverrides[id] = clean;
    else delete itemOverrides[id];
    update({ itemOverrides });
  };

  return (
    <View style={{ gap: sp.lg }}>
      <Notice tone="info">
        Індекс категорії = 50 + 50 × (частка позначених позитивних − частка позначених негативних), з урахуванням ваг.
        50 — нейтрально, 100 — усі позитивні пункти без негативних. Зміни одразу перераховують усю історію: зберігаються
        лише позначки.
      </Notice>

      {CATEGORIES.filter((c) => c.scored).map((cat) => (
        <Card key={cat.id} title={cat.title}>
          <View style={{ gap: sp.lg }}>
            {cat.items.map((item) => {
              const def = { polarity: item.polarity, weight: item.weight ?? 1 };
              const o = settings.itemOverrides[item.id];
              const polarity = o?.polarity ?? def.polarity;
              const weight = o?.weight ?? def.weight;
              return (
                <View key={item.id} style={{ gap: sp.sm }}>
                  <Text
                    style={{
                      color: o ? t.brandInk : t.text,
                      fontSize: font.sm,
                      fontWeight: o ? '700' : '400',
                    }}
                  >
                    {item.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md }}>
                    <Segmented
                      label={`Полярність: ${item.label}`}
                      options={POLARITY}
                      value={String(polarity)}
                      onChange={(v) => v && setOverride(item.id, { polarity: Number(v) as Polarity }, def)}
                    />
                    <View style={{ width: 72 }}>
                      <Input
                        accessibilityLabel={`Вага: ${item.label}`}
                        value={String(weight)}
                        keyboardType="decimal-pad"
                        onChangeText={(v) =>
                          setOverride(item.id, { weight: Math.max(0, Number(v.replace(',', '.')) || 0) }, def)
                        }
                      />
                    </View>
                    <Text style={{ color: t.muted, fontSize: font.xs }}>вага</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ))}

      <Card title="Самостійність">
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
          Самостійність = 100 × (1 − підтримка), підтримка = зважене середнє рівня допомоги й частки застосованих
          адаптацій.
        </Text>
        <View style={{ gap: sp.md }}>
          <NumberField
            label="Вага рівня допомоги"
            value={settings.independence.levelWeight}
            onChange={(v) => update({ independence: { ...settings.independence, levelWeight: v } })}
          />
          <NumberField
            label="Вага адаптацій"
            value={settings.independence.adaptWeight}
            onChange={(v) => update({ independence: { ...settings.independence, adaptWeight: v } })}
          />
          {HELP_LEVELS.map((h) => (
            <NumberField
              key={h.id}
              label={`Рівень «${h.label}» (0–1)`}
              value={Math.round(settings.independence.levels[h.id] * 100) / 100}
              onChange={(v) =>
                update({
                  independence: {
                    ...settings.independence,
                    levels: { ...settings.independence.levels, [h.id]: Math.min(1, Math.max(0, v)) },
                  },
                })
              }
            />
          ))}
        </View>
      </Card>

      <Card title="Пороги для висновків">
        <View style={{ gap: sp.md }}>
          <NumberField
            label="Мін. уроків у періоді"
            value={settings.insights.minLessons}
            onChange={(v) => update({ insights: { ...settings.insights, minLessons: Math.max(1, v) } })}
          />
          <NumberField
            label="Мін. зміна індексу, п.п."
            value={settings.insights.minDelta}
            onChange={(v) => update({ insights: { ...settings.insights, minDelta: Math.max(0, v) } })}
          />
          <NumberField
            label="Мін. зміна пункту, п.п."
            value={settings.insights.minItemDelta}
            onChange={(v) => update({ insights: { ...settings.insights, minItemDelta: Math.max(0, v) } })}
          />
        </View>
      </Card>

      <Button
        variant="danger"
        onPress={() =>
          Alert.alert('Скинути налаштування?', 'Усі ваги й пороги повернуться до стандартних.', [
            { text: 'Скасувати', style: 'cancel' },
            { text: 'Скинути', style: 'destructive', onPress: () => void saveSettings(DEFAULT_SETTINGS) },
          ])
        }
      >
        Скинути до стандартних
      </Button>
    </View>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <Input
        value={String(value)}
        keyboardType="decimal-pad"
        onChangeText={(v) => onChange(Number(v.replace(',', '.')) || 0)}
        style={{ maxWidth: 120 }}
      />
    </Field>
  );
}
