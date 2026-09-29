import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { useStudent } from '../../state/student';
import { deleteHoliday, listHolidays, listSlots, saveHoliday, saveStudent, setSlotSubject } from '../../db/repo';
import { fmtDate, minutesBetween, WEEKDAYS_FULL, WEEKDAYS_SHORT } from '@journal/core';
import { newId, type Bell } from '@journal/core';
import { Button, Card, Field, Input, Notice, PageTitle, Tabs } from '../../components/ui';
// Розбір Excel (SheetJS) вантажиться лише на вкладці імпорту.
const HumanImport = lazy(() => import('./HumanImport'));

type Tab = 'week' | 'bells' | 'holidays' | 'human';

export const COMMON_SUBJECTS = [
  'Українська мова', 'Читання', 'Математика', 'Я досліджую світ', 'Англійська мова', 'Мистецтво',
  'Музичне мистецтво', 'Образотворче мистецтво', 'Фізкультура', 'Дизайн і технології', 'Інформатика',
  'Українська література', 'Зарубіжна література', 'Історія України', 'Всесвітня історія', 'Географія',
  'Біологія', 'Фізика', 'Хімія', 'Алгебра', 'Геометрія', "Основи здоров'я", 'Технології',
  'Корекційно-розвиткове заняття',
];

export default function SchedulePage() {
  const [tab, setTab] = useState<Tab>('week');
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Розклад" subtitle="Тижневий шаблон уроків, дзвінки, канікули та імпорт файлів з Human" />
      <Tabs
        tabs={[
          { id: 'week', label: 'Тижневий розклад' },
          { id: 'bells', label: 'Дзвінки' },
          { id: 'holidays', label: 'Канікули' },
          { id: 'human', label: 'Імпорт з Human' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'week' && <WeekGrid />}
      {tab === 'bells' && <BellsEditor />}
      {tab === 'holidays' && <HolidaysEditor />}
      {tab === 'human' && (
        <Suspense fallback={<div className="p-4 text-sm text-slate-500">Завантаження…</div>}>
          <HumanImport />
        </Suspense>
      )}
    </div>
  );
}

function WeekGrid() {
  const student = useStudent();
  const slots = useLiveQuery(() => listSlots(student.id), [student.id]);
  const [saturday, setSaturday] = useState<boolean | null>(null);
  if (!slots) return null;
  const showSat = saturday ?? slots.some((s) => s.weekday === 6);
  const weekdays = showSat ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const rows = Math.max(7, student.bells.length, ...slots.map((s) => s.lessonNumber));
  const subjects = [...new Set([...slots.map((s) => s.subject), ...COMMON_SUBJECTS])];
  const subjectAt = (wd: number, n: number) =>
    slots.find((s) => s.weekday === wd && s.lessonNumber === n && !s.validFrom && !s.validTo)?.subject ?? '';

  return (
    <Card>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Внесіть розклад один раз — уроки на кожну дату створюються автоматично (поза канікулами). Заміни на конкретний день
        робляться на екрані «Сьогодні». У Human немає експорту розкладу, тож його переносимо вручну.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-10 text-left font-medium text-slate-500">№</th>
              {weekdays.map((wd) => (
                <th key={wd} className="text-left font-medium" title={WEEKDAYS_FULL[wd - 1]}>
                  {WEEKDAYS_SHORT[wd - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => i + 1).map((n) => (
              <tr key={n}>
                <td className="text-slate-500">{n}</td>
                {weekdays.map((wd) => {
                  const value = subjectAt(wd, n);
                  return (
                    <td key={wd}>
                      <Input
                        key={`${wd}-${n}-${value}`}
                        aria-label={`${WEEKDAYS_FULL[wd - 1]}, урок ${n}`}
                        className="h-9"
                        defaultValue={value}
                        list="subjects"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== value) setSlotSubject(student.id, wd, n, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showSat} onChange={(e) => setSaturday(e.target.checked)} />
        Показати суботу
      </label>
    </Card>
  );
}

function BellsEditor() {
  const student = useStudent();
  const bells = [...student.bells].sort((a, b) => a.lessonNumber - b.lessonNumber);
  const save = (next: Bell[]) => saveStudent({ ...student, bells: next });
  const update = (i: number, patch: Partial<Bell>) => save(bells.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addRow = () => {
    const last = bells[bells.length - 1];
    const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const [h, m] = (last?.end ?? '08:00').split(':').map(Number);
    const start = h * 60 + m + 10;
    save([...bells, { lessonNumber: (last?.lessonNumber ?? 0) + 1, start: toTime(start), end: toTime(start + student.lessonMinutes) }]);
  };
  return (
    <Card>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Час уроків показується на екрані «Сьогодні» і визначає тривалість уроку для показника концентрації.
      </p>
      <div className="space-y-2">
        {bells.map((b, i) => (
          <div key={b.lessonNumber} className="flex flex-wrap items-end gap-2">
            <span className="w-16 pb-2 text-sm text-slate-500">Урок {b.lessonNumber}</span>
            <Field label="Початок" className="w-32">
              <Input type="time" value={b.start} onChange={(e) => update(i, { start: e.target.value })} />
            </Field>
            <Field label="Кінець" className="w-32">
              <Input type="time" value={b.end} onChange={(e) => update(i, { end: e.target.value })} />
            </Field>
            <span className="pb-2 text-sm text-slate-500">{minutesBetween(b.start, b.end)} хв</span>
            <Button variant="ghost" size="sm" aria-label={`Видалити урок ${b.lessonNumber}`} onClick={() => save(bells.filter((_, j) => j !== i))}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={addRow}>
        <Plus size={16} /> Додати урок
      </Button>
    </Card>
  );
}

function HolidaysEditor() {
  const student = useStudent();
  const holidays = useLiveQuery(() => listHolidays(student.id), [student.id]);
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <Card>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        У дні канікул уроки з розкладу не створюються. Межі навчального року задаються в профілі дитини ({fmtDate(student.yearStart)} —{' '}
        {fmtDate(student.yearEnd)}).
      </p>
      <ul className="mb-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {holidays?.map((h) => (
          <li key={h.id} className="flex items-center justify-between py-2">
            <span>
              <span className="font-medium">{h.title}</span>{' '}
              <span className="text-slate-500">
                {fmtDate(h.from, 'd MMM')} — {fmtDate(h.to, 'd MMM yyyy')}
              </span>
            </span>
            <Button variant="ghost" size="sm" aria-label={`Видалити ${h.title}`} onClick={() => deleteHoliday(h.id)}>
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
        {!holidays?.length && <li className="py-2 text-slate-500">Канікул ще не додано.</li>}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!from || !to || to < from) return;
          await saveHoliday({ id: newId(), studentId: student.id, title: title.trim() || 'Канікули', from, to, updatedAt: '' });
          setTitle('');
          setFrom('');
          setTo('');
        }}
      >
        <Field label="Назва" className="min-w-40 flex-1">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Осінні канікули" />
        </Field>
        <Field label="З" className="w-40">
          <Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="По" className="w-40">
          <Input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary">
          Додати
        </Button>
      </form>
      {from && to && to < from && (
        <div className="mt-2">
          <Notice tone="warn">Дата завершення раніша за дату початку.</Notice>
        </div>
      )}
    </Card>
  );
}
