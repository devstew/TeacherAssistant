import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronLeft, ClipboardList, Copy, Eraser } from 'lucide-react-native';
import {
  ASSISTANT,
  ATTENTION,
  BEHAVIOR,
  EMOTION,
  HELP_LEVELS,
  LEARNING,
  TEACHER,
  findPreviousObservation,
  fmtDate,
  getLessonObs,
  getLessonsForRange,
  getSettings,
  hasObservationData,
  lessonDuration,
  lessonTime,
  saveLessonObs,
  scoreLesson,
  setAbsent,
  toggleCheck,
  topicsForSubject,
  upsertLesson,
  useDebouncedField,
  useQuery,
  useRepo,
  type HelpLevel,
  type Lesson,
  type LessonObservation,
} from '@journal/core';
import { Badge, Button, Card, Chip, Field, Input, Notice, Segmented, Textarea } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { CategoryBlock } from './CategoryBlock';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

export function LessonScreen() {
  const { student } = useStudents();
  const { date = '', n = '' } = useLocalSearchParams<{ date: string; n: string }>();
  const lessonNumber = Number(n);
  const lessons = useRepo(getLessonsForRange, student!, date, date);
  const lesson = lessons?.find((l) => l.lessonNumber === lessonNumber);
  const obs = useQuery(async () => (lesson ? getLessonObs(lesson.id) : undefined), getLessonObs.tables, [lesson?.id]);
  const settings = useRepo(getSettings);
  const t = useTheme();

  if (!student || !lessons || !settings) return null;

  if (!lesson)
    return (
      <Screen>
        <BackToDay date={date} />
        <Notice tone="warn">Урок не знайдено. Можливо, розклад змінився.</Notice>
      </Screen>
    );

  const idx = lessons.indexOf(lesson);
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const checks = obs?.checks ?? [];
  const save = (patch: Partial<LessonObservation>) => saveLessonObs(lesson, patch);
  const toggle = (id: string) => saveLessonObs(lesson, (cur) => ({ checks: toggleCheck(cur?.checks ?? [], id) }));
  const scores = obs ? scoreLesson(obs, settings, lessonDuration(student, lesson.lessonNumber)) : null;
  const time = lessonTime(student, lesson.lessonNumber);

  return (
    <Screen>
      <BackToDay date={date} />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: sp.md }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: t.muted, fontSize: font.sm }}>
              Урок {lesson.lessonNumber}
              {time ? ` · ${time.start}–${time.end}` : ''}
            </Text>
            <Text style={{ color: t.text, fontSize: font.xl, fontWeight: '700' }}>{lesson.subject}</Text>
          </View>
          <Button
            size="sm"
            variant={lesson.absent ? 'primary' : 'secondary'}
            onPress={() => setAbsent(lesson, !lesson.absent)}
          >
            {lesson.absent ? `${lesson.absenceMarker ?? 'н'} — відсутній` : 'Позначити «н»'}
          </Button>
        </View>
        <TopicField key={lesson.id} lesson={lesson} />
        {lesson.absent && (
          <View style={{ marginTop: sp.md }}>
            <Notice tone="warn">Дитина відсутня — спостереження цього уроку не входять у статистику.</Notice>
          </View>
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
          <View style={{ gap: sp.sm }}>
            <Text style={{ color: t.subtle, fontSize: font.sm, fontWeight: '600' }}>Допомога асистента була потрібна:</Text>
            <Segmented<HelpLevel>
              label="Рівень допомоги"
              options={HELP_LEVELS}
              value={obs?.helpLevel}
              onChange={(v) => save({ helpLevel: v })}
            />
          </View>
        }
      />

      <CommentField key={lesson.id} obs={obs} onSave={(comment) => save({ comment })} />

      <View style={{ gap: sp.sm }}>
        <CopyPrevious lesson={lesson} onCopy={(src) => save({ checks: src.checks, helpLevel: src.helpLevel })} />
        {hasObservationData(obs) && (
          <Button
            variant="ghost"
            icon={<Eraser color={t.subtle} size={16} />}
            onPress={() =>
              Alert.alert('Очистити урок?', 'Усі позначки цього уроку буде знято.', [
                { text: 'Скасувати', style: 'cancel' },
                {
                  text: 'Очистити',
                  style: 'destructive',
                  onPress: () => void save({ checks: [], helpLevel: undefined, attentionMinutes: undefined }),
                },
              ])
            }
          >
            Очистити
          </Button>
        )}
      </View>

      <LessonNav date={date} prev={prev} next={next} />
    </Screen>
  );
}

function BackToDay({ date }: { date: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/', params: { d: date } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}
    >
      <ArrowLeft color={t.subtle} size={16} />
      <Text style={{ color: t.subtle, fontSize: font.sm }}>{date ? fmtDate(date, 'EEEE, d MMMM') : 'До уроків дня'}</Text>
    </Pressable>
  );
}

function TopicField({ lesson }: { lesson: Lesson }) {
  const [topic, setTopic] = useDebouncedField(lesson.topic ?? '', (v) => upsertLesson(lesson, { topic: v.trim() || undefined }));
  const suggestions = useRepo(topicsForSubject, lesson.studentId, lesson.subject);
  const recent = (suggestions ?? []).filter((s) => s !== topic).slice(0, 4);
  return (
    <View style={{ marginTop: sp.md, gap: sp.sm }}>
      <Field label="Тема уроку">
        <Input value={topic} onChangeText={setTopic} placeholder="Введіть тему" />
      </Field>
      {recent.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
          {recent.map((s) => (
            <Chip key={s} on={false} onPress={() => setTopic(s)}>
              {s}
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
}

function MinutesField({ obs, onSave }: { obs?: LessonObservation; onSave: (m: number | undefined) => void }) {
  const [value, setValue] = useDebouncedField(obs?.attentionMinutes?.toString() ?? '', (v) => {
    const m = Number(v);
    onSave(v.trim() && Number.isFinite(m) && m >= 0 ? Math.round(m) : undefined);
  });
  return (
    <Field label="Утримує увагу, хв" hint="Поле «Не стійка ____» на бланку. Необов'язково.">
      <Input value={value} onChangeText={setValue} keyboardType="number-pad" style={{ maxWidth: 140 }} />
    </Field>
  );
}

function CommentField({ obs, onSave }: { obs?: LessonObservation; onSave: (c: string | undefined) => void }) {
  const [value, setValue] = useDebouncedField(obs?.comment ?? '', (v) => onSave(v.trim() || undefined));
  return (
    <Card title="Коментар до уроку">
      <Textarea value={value} onChangeText={setValue} placeholder="Що важливо зафіксувати на цьому уроці" />
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
  const t = useTheme();
  const present = scores ? SCORE_LABELS.filter(([k]) => scores[k] != null) : [];
  if (!scores || !present.length)
    return <Text style={{ color: t.muted, fontSize: font.xs }}>Показники уроку з’являться після перших позначок.</Text>;

  return (
    <View accessibilityLabel="Показники уроку" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
      {present.map(([k, label]) => {
        const v = Math.round(scores[k]!);
        return (
          <Badge key={k} tone={v >= 60 ? 'good' : v < 40 ? 'bad' : 'neutral'}>
            {`${label}: ${v}${k === 'concentration' ? '%' : ''}`}
          </Badge>
        );
      })}
    </View>
  );
}

function CopyPrevious({ lesson, onCopy }: { lesson: Lesson; onCopy: (src: LessonObservation) => void }) {
  const t = useTheme();
  const source = useRepo(findPreviousObservation, lesson);
  if (!source) return null;
  return (
    <Button icon={<Copy color={t.subtle} size={16} />} onPress={() => onCopy(source)}>
      {`Скопіювати з ${source.date}, урок ${source.lessonNumber}`}
    </Button>
  );
}

function LessonNav({ date, prev, next }: { date: string; prev?: Lesson; next?: Lesson }) {
  const t = useTheme();
  const go = (n: number) => router.replace({ pathname: '/day/[date]/lesson/[n]', params: { date, n: String(n) } });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp.sm,
        borderTopWidth: 1,
        borderTopColor: t.line,
        paddingTop: sp.md,
      }}
    >
      <Button
        variant="ghost"
        disabled={!prev}
        icon={<ChevronLeft color={t.subtle} size={16} />}
        onPress={() => prev && go(prev.lessonNumber)}
        style={{ flexShrink: 1 }}
      >
        {prev ? `${prev.lessonNumber}. ${prev.subject}` : 'Попередній'}
      </Button>
      {next ? (
        <Button variant="primary" onPress={() => go(next.lessonNumber)} style={{ flexShrink: 1 }}>
          {`${next.lessonNumber}. ${next.subject}`}
        </Button>
      ) : (
        <Button
          variant="primary"
          icon={<ClipboardList color={t.onBrand} size={16} />}
          onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
        >
          Підсумок дня
        </Button>
      )}
    </View>
  );
}
