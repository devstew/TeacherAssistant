import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { useStudent } from '../../state/student';
import {
  addManualLesson,
  dataExtent,
  getLessonsForRange,
  listDayObs,
  listHolidays,
  listLessonObs,
  listSlots,
  setAbsent,
} from '../../db/repo';
import { hasDayData, hasObservationData } from '@journal/core';
import { lessonTime } from '@journal/core';
import { addDaysISO, eachDate, fmtDate, isoWeekday, todayISO, weekEndISO, weekStartISO, WEEKDAYS_SHORT } from '@journal/core';
import type { ISODate, Lesson, LessonObservation } from '@journal/core';
import { Badge, Button, Card, cx, Input, Notice, PageTitle, Select } from '../../components/ui';

type DayStatus = 'none' | 'empty' | 'partial' | 'full' | 'absent';

function dayStatus(lessons: Lesson[], obs: Map<string, LessonObservation>): DayStatus {
  if (!lessons.length) return 'none';
  const attended = lessons.filter((l) => !l.absent);
  if (!attended.length) return 'absent';
  const filled = attended.filter((l) => hasObservationData(obs.get(l.id))).length;
  return filled === 0 ? 'empty' : filled === attended.length ? 'full' : 'partial';
}

const DOT: Record<DayStatus, string> = {
  none: 'bg-transparent',
  empty: 'bg-slate-300 dark:bg-slate-600',
  partial: 'bg-amber-400',
  full: 'bg-emerald-500',
  absent: 'bg-rose-400',
};

export default function TodayPage() {
  const student = useStudent();
  const [params, setParams] = useSearchParams();
  const extent = useLiveQuery(() => dataExtent(student.id), [student.id]);
  const today = todayISO();
  const inYear = today >= student.yearStart && today <= student.yearEnd;
  const date: ISODate | undefined =
    params.get('d') ?? (inYear ? today : extent === undefined ? undefined : (extent?.to ?? student.yearStart));

  if (!date) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  return <DayView date={date} onDate={(d) => setParams({ d }, { replace: true })} fallback={!params.get('d') && !inYear} />;
}

function DayView({ date, onDate, fallback }: { date: ISODate; onDate: (d: ISODate) => void; fallback: boolean }) {
  const student = useStudent();
  const weekStart = weekStartISO(date);
  const weekEnd = weekEndISO(date);

  const week = useLiveQuery(async () => {
    const [lessons, obs, days, slots, holidays] = await Promise.all([
      getLessonsForRange(student, weekStart, weekEnd),
      listLessonObs(student.id, weekStart, weekEnd),
      listDayObs(student.id, weekStart, weekEnd),
      listSlots(student.id),
      listHolidays(student.id),
    ]);
    return { lessons, obs: new Map(obs.map((o) => [o.id, o])), days, slots, holidays };
  }, [student, weekStart, weekEnd]);

  if (!week) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;

  const weekendUsed = week.slots.some((s) => s.weekday >= 6) || week.lessons.some((l) => isoWeekday(l.date) >= 6);
  const days = eachDate(weekStart, weekEnd).filter((d) => weekendUsed || isoWeekday(d) <= 5);
  const lessons = week.lessons.filter((l) => l.date === date);
  const dayObs = week.days.find((d) => d.date === date);
  const holiday = week.holidays.find((h) => h.from <= date && date <= h.to);
  const outOfYear = date < student.yearStart || date > student.yearEnd;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title={fmtDate(date, 'EEEE, d MMMM')}
        subtitle={`${student.name}${student.className ? ` · ${student.className}` : ''} · ${student.schoolYear} н.р.`}
        actions={
          date !== todayISO() && (
            <Button size="sm" onClick={() => onDate(todayISO())}>
              Сьогодні
            </Button>
          )
        }
      />

      {fallback && (
        <div className="mb-3">
          <Notice tone="info">Сьогодні поза межами навчального року дитини — показано останній день з даними.</Notice>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" aria-label="Попередній тиждень" onClick={() => onDate(addDaysISO(weekStart, -7))}>
          <ChevronLeft size={18} />
        </Button>
        <div className={cx('grid flex-1 gap-1', days.length === 7 ? 'grid-cols-7' : 'grid-cols-5')}>
          {days.map((d) => {
            const st = dayStatus(
              week.lessons.filter((l) => l.date === d),
              week.obs,
            );
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDate(d)}
                aria-current={d === date ? 'date' : undefined}
                className={cx(
                  'flex flex-col items-center rounded-lg py-1.5 text-sm',
                  d === date ? 'bg-brand-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <span className={cx('text-[11px]', d === date ? 'text-brand-100' : 'text-slate-500')}>{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
                <span className="font-semibold">{Number(d.slice(8))}</span>
                <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', DOT[st])} />
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" aria-label="Наступний тиждень" onClick={() => onDate(addDaysISO(weekStart, 7))}>
          <ChevronRight size={18} />
        </Button>
      </div>

      <div className="space-y-2">
        {lessons.map((l) => {
          const obs = week.obs.get(l.id);
          const time = lessonTime(student, l.lessonNumber);
          return (
            <div
              key={l.id}
              className="flex items-stretch gap-2 rounded-xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <Link to={`/day/${date}/lesson/${l.lessonNumber}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  {l.lessonNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.subject}</span>
                    {time && <span className="text-xs text-slate-500">{time.start}–{time.end}</span>}
                  </span>
                  <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{l.topic || 'Тема не вказана'}</span>
                </span>
                {l.absent ? (
                  <Badge tone="warn">н — відсутній</Badge>
                ) : hasObservationData(obs) ? (
                  <Badge tone="good">Заповнено</Badge>
                ) : (
                  <Badge>Не заповнено</Badge>
                )}
              </Link>
              <button
                type="button"
                aria-pressed={!!l.absent}
                title="Позначити відсутність («н»)"
                onClick={() => setAbsent(l, !l.absent)}
                className={cx(
                  'w-12 shrink-0 rounded-r-xl border-l border-slate-200 text-sm font-semibold dark:border-slate-800',
                  l.absent ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                н
              </button>
            </div>
          );
        })}

        {!lessons.length && (
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {outOfYear
                ? 'Дата поза межами навчального року (змініть межі в налаштуваннях профілю).'
                : holiday
                  ? `Канікули: ${holiday.title}.`
                  : isoWeekday(date) >= 6
                    ? 'Вихідний день.'
                    : week.slots.length
                      ? 'За розкладом уроків немає.'
                      : 'Розклад ще не заповнено.'}
            </p>
            {!week.slots.length && (
              <Link to="/schedule" className="mt-2 inline-block text-sm font-medium text-brand-700 underline dark:text-brand-200">
                Заповнити тижневий розклад
              </Link>
            )}
          </Card>
        )}
      </div>

      {lessons.length > 0 && (
        <Link
          to={`/day/${date}`}
          className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800"
        >
          <ClipboardList size={20} className="text-brand-700 dark:text-brand-200" aria-hidden />
          <span className="flex-1">
            <span className="block font-medium">Підсумок дня</span>
            <span className="block text-sm text-slate-500">Комунікативні та соціальні навички, примітка</span>
          </span>
          {hasDayData(dayObs) ? <Badge tone="good">Заповнено</Badge> : <Badge>Не заповнено</Badge>}
        </Link>
      )}

      {!outOfYear && <AddLesson date={date} taken={lessons.map((l) => l.lessonNumber)} />}
    </div>
  );
}

function AddLesson({ date, taken }: { date: ISODate; taken: number[] }) {
  const student = useStudent();
  const [open, setOpen] = useState(false);
  const free = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => !taken.includes(n));
  const [n, setN] = useState(free[0] ?? 1);
  const [subject, setSubject] = useState('');
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <Plus size={16} /> Додати урок на цей день
      </Button>
    );
  }
  return (
    <Card className="mt-3" title="Додатковий урок">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!subject.trim()) return;
          await addManualLesson(student, date, n, subject.trim());
          setOpen(false);
          setSubject('');
        }}
      >
        <label className="w-24">
          <span className="mb-1 block text-sm">Урок №</span>
          <Select value={n} onChange={(e) => setN(Number(e.target.value))}>
            {free.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-sm">Предмет</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Напр. Математика" autoFocus />
        </label>
        <Button type="submit" variant="primary">
          Додати
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Скасувати
        </Button>
      </form>
    </Card>
  );
}
