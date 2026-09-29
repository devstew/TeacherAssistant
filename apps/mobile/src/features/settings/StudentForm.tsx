import { useState } from 'react';
import { Text, View } from 'react-native';
import { schoolYearFor, type Student } from '@journal/core';
import { Button, Field, Input } from '@/components/ui';
import { DateField } from '@/components/fields';
import { font, sp, useTheme } from '@/theme';

export function StudentForm({
  initial,
  onSave,
  submitLabel = 'Зберегти',
}: {
  initial: Student;
  onSave: (s: Student) => void | Promise<void>;
  submitLabel?: string;
}) {
  const t = useTheme();
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Student>(k: K, v: Student[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };
  const year = Number(s.yearStart.slice(0, 4)) || new Date().getFullYear();
  const years = [year - 1, year, year + 1, year + 2];

  return (
    <View style={{ gap: sp.md }}>
      <Field label="ПІБ або псевдонім дитини" hint="Можна використовувати ініціали — дані залишаються на цьому пристрої.">
        <Input value={s.name} onChangeText={(v) => set('name', v)} placeholder="Напр. Андрій К." autoCapitalize="words" />
      </Field>
      <Field label="Клас">
        <Input value={s.className} onChangeText={(v) => set('className', v)} placeholder="Напр. 3-Б" />
      </Field>
      <Field label="ПІБ асистента вчителя" hint="Для шапки експортованих документів.">
        <Input value={s.assistantName} onChangeText={(v) => set('assistantName', v)} autoCapitalize="words" />
      </Field>
      <Field label="Ім'я дитини в Human" hint="Як записано в журналі Human — для зіставлення при імпорті файлів.">
        <Input value={s.humanName ?? ''} onChangeText={(v) => set('humanName', v || undefined)} />
      </Field>
      <Field label="Початок навчального року">
        <DateField
          label="Початок року"
          value={s.yearStart}
          years={years}
          onChange={(v) => {
            setS((prev) => ({ ...prev, yearStart: v, schoolYear: schoolYearFor(v).label }));
            setSaved(false);
          }}
        />
      </Field>
      <Field label="Кінець навчального року">
        <DateField label="Кінець року" value={s.yearEnd} years={years} onChange={(v) => set('yearEnd', v)} />
      </Field>
      <Field label="Тривалість уроку, хв" hint="Якщо для уроку не задано дзвінок.">
        <Input
          value={String(s.lessonMinutes)}
          onChangeText={(v) => set('lessonMinutes', Number(v.replace(/\D/g, '')) || 45)}
          keyboardType="number-pad"
          style={{ maxWidth: 120 }}
        />
      </Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md }}>
        <Button
          variant="primary"
          disabled={!s.name.trim()}
          onPress={async () => {
            await onSave({ ...s, name: s.name.trim() });
            setSaved(true);
          }}
        >
          {submitLabel}
        </Button>
        {saved && <Text style={{ color: t.tones.good.fg, fontSize: font.sm }}>Збережено</Text>}
      </View>
    </View>
  );
}
