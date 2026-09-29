import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Copy, Eraser } from 'lucide-react';
import { useStudent } from '../../state/student';
import {
  findPreviousObservation,
  getLessonObs,
  getLessonsForRange,
  getSettings,
  saveLessonObs,
  setAbsent,
  topicsForSubject,
  upsertLesson,
} from '@journal/core';
import {
  ASSISTANT,
  ATTENTION,
  BEHAVIOR,
  EMOTION,
  HELP_LEVELS,
  LEARNING,
  TEACHER,
  toggleCheck,
  type HelpLevel,
} from '@journal/core';
import { useQuery, useRepo } from '@journal/core';
import { hasObservationData, scoreLesson } from '@journal/core';
import { lessonDuration, lessonTime } from '@journal/core';
import { fmtDate } from '@journal/core';
import type { Lesson, LessonObservation } from '@journal/core';
import { Badge, Button, Card, Field, Input, Notice, Segmented, Textarea } from '../../components/ui';
import { useDebouncedField } from '@journal/core';
import { CategoryBlock } from './CategoryBlock';

export default function LessonPage() {
  const student = useStudent();
  const { date = '', n = '' } = useParams();
  const lessonNumber = Number(n);
  const lessons = useRepo(getLessonsForRange, student, date, date);
  const lesson = lessons?.find((l) => l.lessonNumber === lessonNumber);
  const obs = useQuery(async () => (lesson ? getLessonObs(lesson.id) : undefined), getLessonObs.tables, [lesson?.id]);
  const settings = useRepo(getSettings);

  if (!lessons || !settings) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl">
        <Notice tone="warn">Урок не знайдено. Можливо, розклад змінився.</Notice>
        <Link to={`/?d=${date}`} className="mt-3 inline-block text-sm text-brand-700 underline">
          До уроків дня
        </Link>
      </div>
    );
  }

  const idx = lessons.indexOf(lesson);
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const checks = obs?.checks ?? [];
  const save = (patch: Partial<LessonObservation>) => saveLessonObs(lesson, patch);
  const toggle = (id: string) => saveLessonObs(lesson, (cur) => ({ checks: toggleCheck(cur?.checks ?? [], id) }));
  const scores = obs ? scoreLesson(obs, settings, lessonDuration(student, lesson.lessonNumber)) : null;
  const time = lessonTime(student, lesson.lessonNumber);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center gap-2">
        <Link to={`/?d=${date}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300">
          <ArrowLeft size={16} /> {fmtDate(date, 'EEEE, d MMMM')}
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">
              Урок {lesson.lessonNumber}
              {time && ` · ${time.start}–${time.end}`}
            </div>
            <h1 className="text-xl font-semibold">{lesson.subject}</h1>
          </div>
          <Button
            variant={lesson.absent ? 'primary' : 'secondary'}
            aria-pressed={!!lesson.absent}
            onClick={() => setAbsent(lesson, !lesson.absent)}
          >
            {lesson.absent ? `${lesson.absenceMarker ?? 'н'} — відсутній` : 'Позначити «н»'}
          </Button>
        </div>
        <TopicField key={lesson.id} lesson={lesson} />
        {lesson.absent && (
          <div className="mt-3">
            <Notice tone="warn">Дитина відсутня на уроці — спостереження цього уроку не входять у статистику.</Notice>
          </div>
        )}
      </Card>

      <ScoresBar scores={scores} />

      <CategoryBlock cat={LEARNING} checks={checks} onToggle={toggle} />
      <CategoryBlock cat={ATTENTION} checks={checks} onToggle={toggle}>
        <MinutesField key={lesson.id} obs={obs} onSave={(m) => save({ attentionMinutes: m })} />
      </CategoryBlock>
      <CategoryBlock cat={EMOTION} checks={checks} onToggle={toggle} />
      <CategoryBlock cat={BEHAVIOR} checks={checks} onToggle={toggle} />
      <CategoryBlock cat={TEACHER} checks={checks} onToggle={toggle} />
      <CategoryBlock
        cat={ASSISTANT}
        checks={checks}
        onToggle={toggle}
        before={
          <div>
            <div className="mb-1.5 text-sm font-medium">Допомога асистента була потрібна:</div>
            <Segmented<HelpLevel>
              label="Рівень допомоги"
              options={HELP_LEVELS}
              value={obs?.helpLevel}
              onChange={(v) => save({ helpLevel: v })}
            />
          </div>
        }
      />

      <CommentField key={lesson.id} obs={obs} onSave={(comment) => save({ comment })} />

      <div className="flex flex-wrap gap-2">
        <CopyPrevious lesson={lesson} onCopy={(src) => save({ checks: src.checks, helpLevel: src.helpLevel })} />
        {hasObservationData(obs) && (
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm('Очистити всі позначки цього уроку?')) save({ checks: [], helpLevel: undefined, attentionMinutes: undefined });
            }}
          >
            <Eraser size={16} /> Очистити
          </Button>
        )}
      </div>

      <LessonNav date={date} prev={prev} next={next} />
    </div>
  );
}

function TopicField({ lesson }: { lesson: Lesson }) {
  const [topic, setTopic] = useDebouncedField(lesson.topic ?? '', (v) => upsertLesson(lesson, { topic: v.trim() || undefined }));
  const suggestions = useRepo(topicsForSubject, lesson.studentId, lesson.subject);
  const listId = `topics-${lesson.id}`;
  return (
    <Field label="Тема уроку" className="mt-3">
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} list={listId} placeholder="Введіть або виберіть тему" />
      <datalist id={listId}>
        {suggestions?.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </Field>
  );
}

function MinutesField({ obs, onSave }: { obs?: LessonObservation; onSave: (m: number | undefined) => void }) {
  const [value, setValue] = useDebouncedField(obs?.attentionMinutes?.toString() ?? '', (v) => {
    const m = Number(v);
    onSave(v.trim() && Number.isFinite(m) && m >= 0 ? Math.round(m) : undefined);
  });
  return (
    <Field label="Утримує увагу, хв" hint="Поле «Не стійка ____» на бланку. Необов'язково." className="max-w-48">
      <Input type="number" inputMode="numeric" min={0} max={90} value={value} onChange={(e) => setValue(e.target.value)} />
    </Field>
  );
}

function CommentField({ obs, onSave }: { obs?: LessonObservation; onSave: (c: string | undefined) => void }) {
  const [value, setValue] = useDebouncedField(obs?.comment ?? '', (v) => onSave(v.trim() || undefined));
  return (
    <Card title="Коментар до уроку">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Що важливо зафіксувати на цьому уроці" />
    </Card>
  );
}

const SCORE_LABELS: [keyof NonNullable<ReturnType<typeof scoreLesson>>, string][] = [
  ['learning', 'Навч. діяльність'],
  ['attention', 'Увага'],
  ['emotion', 'Емоції'],
  ['behavior', 'Поведінка'],
  ['teacher', 'З вчителем'],
  ['independence', 'Самостійність'],
  ['concentration', 'Концентрація'],
];

function ScoresBar({ scores }: { scores: ReturnType<typeof scoreLesson> | null }) {
  const present = scores ? SCORE_LABELS.filter(([k]) => scores[k] != null) : [];
  // Місце під панель зарезервоване, щоб форма не «стрибала» після першої позначки.
  if (!scores || !present.length) {
    return <p className="min-h-6 text-xs leading-6 text-slate-500">Показники уроку з'являться після перших позначок.</p>;
  }
  return (
    <div className="flex min-h-6 flex-wrap gap-1.5" aria-label="Показники уроку">
      {present.map(([k, label]) => {
        const v = Math.round(scores[k]!);
        return (
          <Badge key={k} tone={v >= 60 ? 'good' : v < 40 ? 'bad' : 'neutral'}>
            {label}: {v}
            {k === 'concentration' ? '%' : ''}
          </Badge>
        );
      })}
    </div>
  );
}

function CopyPrevious({ lesson, onCopy }: { lesson: Lesson; onCopy: (src: LessonObservation) => void }) {
  const source = useRepo(findPreviousObservation, lesson);
  if (!source) return null;
  return (
    <Button onClick={() => onCopy(source)} title={`${source.date}, урок ${source.lessonNumber}`}>
      <Copy size={16} /> Скопіювати з попереднього уроку
    </Button>
  );
}

function LessonNav({ date, prev, next }: { date: string; prev?: Lesson; next?: Lesson }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      <Button variant="ghost" disabled={!prev} onClick={() => prev && navigate(`/day/${date}/lesson/${prev.lessonNumber}`)}>
        <ChevronLeft size={16} /> {prev ? `${prev.lessonNumber}. ${prev.subject}` : 'Попередній'}
      </Button>
      {next ? (
        <Button variant="primary" onClick={() => navigate(`/day/${date}/lesson/${next.lessonNumber}`)}>
          {next.lessonNumber}. {next.subject} <ChevronRight size={16} />
        </Button>
      ) : (
        <Button variant="primary" onClick={() => navigate(`/day/${date}`)}>
          <ClipboardList size={16} /> Підсумок дня
        </Button>
      )}
    </div>
  );
}
