import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useStudent } from '../../state/student';
import { getDayObs, getLessonsForRange, getSettings, listLessonObs, saveDayObs } from '../../db/repo';
import { SOCIAL, toggleCheck } from '@journal/core';
import { hasObservationData, mean, scoreDay, scoreLesson } from '@journal/core';
import { lessonDuration } from '@journal/core';
import { fmtDate } from '@journal/core';
import type { DayObservation } from '@journal/core';
import { Badge, Card, Textarea } from '../../components/ui';
import { useDebouncedField } from '@journal/core';
import { CategoryBlock } from './CategoryBlock';

export default function DayPage() {
  const student = useStudent();
  const { date = '' } = useParams();
  const data = useLiveQuery(async () => {
    const [lessons, obs, day, settings] = await Promise.all([
      getLessonsForRange(student, date, date),
      listLessonObs(student.id, date, date),
      getDayObs(student.id, date),
      getSettings(),
    ]);
    return { lessons, obs: new Map(obs.map((o) => [o.id, o])), day, settings };
  }, [student, date]);

  if (!data) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  const { lessons, obs, day, settings } = data;
  const save = (patch: Partial<DayObservation>) => saveDayObs(student.id, date, patch);

  const scored = lessons
    .filter((l) => !l.absent)
    .map((l) => obs.get(l.id))
    .filter(hasObservationData)
    .map((o) => scoreLesson(o, settings, lessonDuration(student, o.lessonNumber)));
  const learning = mean(scored.map((s) => s.learningComposite));
  const behavior = mean(scored.map((s) => s.behaviorComposite));
  const social = day ? scoreDay(day, settings).social : null;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link to={`/?d=${date}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300">
        <ArrowLeft size={16} /> До уроків дня
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Підсумок дня</h1>
        <p className="text-sm text-slate-500">{fmtDate(date, 'EEEE, d MMMM yyyy')}</p>
      </div>

      <Card title="Уроки дня">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <Link to={`/day/${date}/lesson/${l.lessonNumber}`} className="hover:underline">
                {l.lessonNumber}. {l.subject}
              </Link>
              {l.absent ? (
                <Badge tone="warn">н</Badge>
              ) : hasObservationData(obs.get(l.id)) ? (
                <Badge tone="good">Заповнено</Badge>
              ) : (
                <Badge>Не заповнено</Badge>
              )}
            </li>
          ))}
        </ul>
        {(learning != null || behavior != null || social != null) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {learning != null && <Badge tone="info">Навчання за день: {Math.round(learning)}</Badge>}
            {behavior != null && <Badge tone="info">Поведінка за день: {Math.round(behavior)}</Badge>}
            {social != null && <Badge tone="info">Комунікація: {Math.round(social)}</Badge>}
          </div>
        )}
      </Card>

      <CategoryBlock
        cat={SOCIAL}
        checks={day?.checks ?? []}
        onToggle={(id) => saveDayObs(student.id, date, (cur) => ({ checks: toggleCheck(cur?.checks ?? [], id) }))}
      />
      <NoteField key={date} day={day} onSave={(note) => save({ note })} />
    </div>
  );
}

function NoteField({ day, onSave }: { day?: DayObservation; onSave: (note: string | undefined) => void }) {
  const [value, setValue] = useDebouncedField(day?.note ?? '', (v) => onSave(v.trim() || undefined));
  return (
    <Card title="Примітка">
      <Textarea
        className="min-h-36"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Досягнення, труднощі, навички самообслуговування, рекомендації"
      />
    </Card>
  );
}
