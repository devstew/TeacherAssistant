import { useState } from 'react';
import type { Student } from '../../domain/types';
import { schoolYearFor } from '../../domain/dates';
import { Button, Field, Input } from '../../components/ui';

export function StudentForm({
  initial,
  onSave,
  submitLabel = 'Зберегти',
  compact = false,
}: {
  initial: Student;
  onSave: (s: Student) => void | Promise<void>;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Student>(k: K, v: Student[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!s.name.trim()) return;
        await onSave({ ...s, name: s.name.trim() });
        setSaved(true);
      }}
    >
      <Field label="ПІБ або псевдонім дитини" hint="Можна використовувати ініціали — документи й дані залишаються на цьому пристрої.">
        <Input required value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Напр. Андрій К." />
      </Field>
      <Field label="Клас">
        <Input value={s.className} onChange={(e) => set('className', e.target.value)} placeholder="Напр. 3-Б" />
      </Field>
      <Field label="ПІБ асистента вчителя" hint="Для шапки експортованих документів.">
        <Input value={s.assistantName} onChange={(e) => set('assistantName', e.target.value)} />
      </Field>
      {!compact && (
        <>
          <Field label="Ім'я дитини в Human" hint="Як записано в журналі Human — для зіставлення при імпорті файлів.">
            <Input value={s.humanName ?? ''} onChange={(e) => set('humanName', e.target.value || undefined)} />
          </Field>
          <Field label="Початок навчального року">
            <Input
              type="date"
              value={s.yearStart}
              onChange={(e) => {
                const y = schoolYearFor(e.target.value || s.yearStart);
                setS((prev) => ({ ...prev, yearStart: e.target.value, schoolYear: y.label }));
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Кінець навчального року">
            <Input type="date" value={s.yearEnd} onChange={(e) => set('yearEnd', e.target.value)} />
          </Field>
          <Field label="Тривалість уроку, хв" hint="Якщо для уроку не задано дзвінок.">
            <Input
              type="number"
              min={20}
              max={90}
              value={s.lessonMinutes}
              onChange={(e) => set('lessonMinutes', Number(e.target.value) || 45)}
            />
          </Field>
        </>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-300">Збережено</span>}
      </div>
    </form>
  );
}
