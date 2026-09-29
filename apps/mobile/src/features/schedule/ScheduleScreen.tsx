import { useState } from 'react';
import { Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import {
  COMMON_SUBJECTS,
  deleteHoliday,
  fmtDate,
  listHolidays,
  listSlots,
  minutesBetween,
  newId,
  saveHoliday,
  saveStudent,
  setSlotSubject,
  useRepo,
  WEEKDAYS_FULL,
  WEEKDAYS_SHORT,
  type Bell,
  type Student,
} from '@journal/core';
import { Button, Card, Field, Input, Notice, PageTitle, Segmented, Select, Tabs } from '@/components/ui';
import { DateField, TimeField } from '@/components/fields';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

type Tab = 'week' | 'bells' | 'holidays' | 'human';

export function ScheduleScreen() {
  const [tab, setTab] = useState<Tab>('week');
  const { student } = useStudents();
  if (!student) return null;

  return (
    <Screen>
      <PageTitle title="Розклад" subtitle="Тижневий шаблон уроків, дзвінки та канікули" />
      <Tabs
        tabs={[
          { id: 'week', label: 'Тиждень' },
          { id: 'bells', label: 'Дзвінки' },
          { id: 'holidays', label: 'Канікули' },
          { id: 'human', label: 'З Human' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'week' && <WeekGrid student={student} />}
      {tab === 'bells' && <BellsEditor student={student} />}
      {tab === 'holidays' && <HolidaysEditor student={student} />}
      {tab === 'human' && (
        <Card title="Імпорт з Human">
          <Soon what="Завантаження файлів відвідуваності й тем уроків із журналу Human просто з телефона." />
        </Card>
      )}
    </Screen>
  );
}

/**
 * На телефоні таблиця 6×8 не вміщається, тому розклад заповнюється по одному
 * дню: вибір дня зверху, під ним рядки уроків.
 */
function WeekGrid({ student }: { student: Student }) {
  const t = useTheme();
  const slots = useRepo(listSlots, student.id);
  const [weekday, setWeekday] = useState(String(new Date().getDay() || 7));
  const [showSat, setShowSat] = useState<boolean | null>(null);

  if (!slots) return null;

  const wd = Math.min(Number(weekday), 6);
  const saturday = showSat ?? slots.some((s) => s.weekday === 6);
  const weekdays = saturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const rows = Math.max(7, student.bells.length, ...slots.map((s) => s.lessonNumber));
  const known = [...new Set([...slots.map((s) => s.subject), ...COMMON_SUBJECTS])].filter(Boolean);
  const subjectAt = (n: number) =>
    slots.find((s) => s.weekday === wd && s.lessonNumber === n && !s.validFrom && !s.validTo)?.subject ?? '';

  return (
    <View style={{ gap: sp.lg }}>
      <Card>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
          Внесіть розклад один раз — уроки на кожну дату створюються автоматично (поза канікулами). Заміни на конкретний
          день робляться на екрані «Сьогодні».
        </Text>
        <Segmented
          label="День тижня"
          options={weekdays.map((d) => ({ id: String(d), label: WEEKDAYS_SHORT[d - 1] }))}
          value={String(wd)}
          onChange={(v) => v && setWeekday(v)}
        />
        <Text style={{ color: t.muted, fontSize: font.xs, marginTop: sp.sm }}>{WEEKDAYS_FULL[wd - 1]}</Text>
      </Card>

      <Card title="Уроки дня">
        <View style={{ gap: sp.md }}>
          {Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
            <SlotRow
              key={`${wd}-${n}`}
              n={n}
              value={subjectAt(n)}
              known={known}
              onSave={(v) => setSlotSubject(student.id, wd, n, v)}
            />
          ))}
        </View>
      </Card>

      {!saturday && (
        <Button variant="ghost" onPress={() => setShowSat(true)}>
          Показати суботу
        </Button>
      )}
    </View>
  );
}

function SlotRow({
  n,
  value,
  known,
  onSave,
}: {
  n: number;
  value: string;
  known: string[];
  onSave: (v: string) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState(value);
  // Рядок перемальовується при зміні дня, тому зовнішнє значення підхоплюємо тут.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
      <Text style={{ color: t.muted, fontSize: font.sm, width: 18 }}>{n}</Text>
      <View style={{ flex: 1 }}>
        <Input
          value={text}
          onChangeText={setText}
          onEndEditing={() => text.trim() !== value && onSave(text)}
          onBlur={() => text.trim() !== value && onSave(text)}
          placeholder="—"
          accessibilityLabel={`Урок ${n}`}
          returnKeyType="done"
        />
      </View>
      <View style={{ width: 44 }}>
        <Select
          label={`Урок ${n}: вибрати предмет`}
          value={undefined}
          placeholder=""
          options={known.map((s) => ({ id: s, label: s }))}
          onChange={(v) => {
            setText(v);
            setSeen(v);
            onSave(v);
          }}
        />
      </View>
    </View>
  );
}

function BellsEditor({ student }: { student: Student }) {
  const t = useTheme();
  const bells = [...student.bells].sort((a, b) => a.lessonNumber - b.lessonNumber);
  const save = (next: Bell[]) => saveStudent({ ...student, bells: next });
  const update = (i: number, patch: Partial<Bell>) => save(bells.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addRow = () => {
    const last = bells[bells.length - 1];
    const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const [h, m] = (last?.end ?? '08:00').split(':').map(Number);
    const start = h * 60 + m + 10;
    save([
      ...bells,
      { lessonNumber: (last?.lessonNumber ?? 0) + 1, start: toTime(start), end: toTime(start + student.lessonMinutes) },
    ]);
  };

  return (
    <Card>
      <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
        Час уроків показується на екрані «Сьогодні» і визначає тривалість уроку для показника концентрації.
      </Text>
      <View style={{ gap: sp.lg }}>
        {bells.map((b, i) => (
          <View key={b.lessonNumber} style={{ gap: sp.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontSize: font.sm, fontWeight: '600' }}>
                Урок {b.lessonNumber} · {minutesBetween(b.start, b.end)} хв
              </Text>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 color={t.danger} size={16} />}
                accessibilityLabel={`Видалити урок ${b.lessonNumber}`}
                onPress={() => save(bells.filter((_, j) => j !== i))}
              />
            </View>
            <TimeField label={`Урок ${b.lessonNumber}, початок`} value={b.start} onChange={(v) => update(i, { start: v })} />
            <TimeField label={`Урок ${b.lessonNumber}, кінець`} value={b.end} onChange={(v) => update(i, { end: v })} />
          </View>
        ))}
      </View>
      <Button style={{ marginTop: sp.lg }} icon={<Plus color={t.subtle} size={16} />} onPress={addRow}>
        Додати урок
      </Button>
    </Card>
  );
}

function HolidaysEditor({ student }: { student: Student }) {
  const t = useTheme();
  const holidays = useRepo(listHolidays, student.id);
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const years = [Number(student.yearStart.slice(0, 4)), Number(student.yearEnd.slice(0, 4))].filter(
    (y, i, a) => a.indexOf(y) === i,
  );
  const wrongOrder = !!from && !!to && to < from;

  return (
    <View style={{ gap: sp.lg }}>
      <Card title="Канікули">
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
          У дні канікул уроки з розкладу не створюються. Межі навчального року задаються в профілі дитини (
          {fmtDate(student.yearStart)} — {fmtDate(student.yearEnd)}).
        </Text>
        <View style={{ gap: sp.sm }}>
          {holidays?.map((h) => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.sm }}>
              <Text style={{ color: t.text, fontSize: font.sm, flexShrink: 1 }}>
                {h.title}{' '}
                <Text style={{ color: t.muted }}>
                  {fmtDate(h.from, 'd MMM')} — {fmtDate(h.to, 'd MMM yyyy')}
                </Text>
              </Text>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 color={t.danger} size={16} />}
                accessibilityLabel={`Видалити ${h.title}`}
                onPress={() => deleteHoliday(h.id)}
              />
            </View>
          ))}
          {!holidays?.length && <Text style={{ color: t.muted, fontSize: font.sm }}>Канікул ще не додано.</Text>}
        </View>
      </Card>

      <Card title="Додати канікули">
        <View style={{ gap: sp.md }}>
          <Field label="Назва">
            <Input value={title} onChangeText={setTitle} placeholder="Осінні канікули" />
          </Field>
          <Field label="З">
            <DateField label="Початок" value={from} years={years} onChange={setFrom} />
          </Field>
          <Field label="По">
            <DateField label="Кінець" value={to} years={years} onChange={setTo} />
          </Field>
          {wrongOrder && <Notice tone="warn">Дата завершення раніша за дату початку.</Notice>}
          <Button
            variant="primary"
            disabled={!from || !to || wrongOrder}
            onPress={async () => {
              await saveHoliday({
                id: newId(),
                studentId: student.id,
                title: title.trim() || 'Канікули',
                from,
                to,
                updatedAt: '',
              });
              setTitle('');
              setFrom('');
              setTo('');
            }}
          >
            Додати
          </Button>
        </View>
      </Card>
    </View>
  );
}
