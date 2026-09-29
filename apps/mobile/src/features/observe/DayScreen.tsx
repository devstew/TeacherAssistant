import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import {
  SOCIAL,
  fmtDate,
  getDayObs,
  getLessonsForRange,
  getSettings,
  hasObservationData,
  lessonDuration,
  listLessonObs,
  mean,
  saveDayObs,
  scoreDay,
  scoreLesson,
  toggleCheck,
  useDebouncedField,
  useQuery,
  type DayObservation,
} from '@journal/core';
import { Badge, Card, Textarea } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { CategoryBlock } from './CategoryBlock';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

export function DayScreen() {
  const t = useTheme();
  const { student } = useStudents();
  const { date = '' } = useLocalSearchParams<{ date: string }>();

  const data = useQuery(
    async () => {
      if (!student) return undefined;
      const [lessons, obs, day, settings] = await Promise.all([
        getLessonsForRange(student, date, date),
        listLessonObs(student.id, date, date),
        getDayObs(student.id, date),
        getSettings(),
      ]);
      return { lessons, obs: new Map(obs.map((o) => [o.id, o])), day, settings };
    },
    ['lessons', 'timetable', 'holidays', 'lessonObs', 'dayObs', 'settings'],
    [student?.id, date],
  );

  if (!student || !data) return null;
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
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/', params: { d: date } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}
      >
        <ArrowLeft color={t.subtle} size={16} />
        <Text style={{ color: t.subtle, fontSize: font.sm }}>До уроків дня</Text>
      </Pressable>

      <View>
        <Text style={{ color: t.text, fontSize: font.xl, fontWeight: '700' }}>Підсумок дня</Text>
        <Text style={{ color: t.muted, fontSize: font.sm }}>{date && fmtDate(date, 'EEEE, d MMMM yyyy')}</Text>
      </View>

      <Card title="Уроки дня">
        <View style={{ gap: sp.sm }}>
          {lessons.map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/day/[date]/lesson/[n]', params: { date, n: String(l.lessonNumber) } })
              }
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.sm, minHeight: 32 }}
            >
              <Text style={{ color: t.text, fontSize: font.sm, flexShrink: 1 }} numberOfLines={1}>
                {l.lessonNumber}. {l.subject}
              </Text>
              {l.absent ? (
                <Badge tone="warn">н</Badge>
              ) : hasObservationData(obs.get(l.id)) ? (
                <Badge tone="good">Заповнено</Badge>
              ) : (
                <Badge>Не заповн.</Badge>
              )}
            </Pressable>
          ))}
          {(learning != null || behavior != null || social != null) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: sp.sm }}>
              {learning != null && <Badge tone="info">{`Навчання за день: ${Math.round(learning)}`}</Badge>}
              {behavior != null && <Badge tone="info">{`Поведінка за день: ${Math.round(behavior)}`}</Badge>}
              {social != null && <Badge tone="info">{`Комунікація: ${Math.round(social)}`}</Badge>}
            </View>
          )}
        </View>
      </Card>

      <CategoryBlock
        cat={SOCIAL}
        checks={day?.checks ?? []}
        onToggle={(id) => saveDayObs(student.id, date, (cur) => ({ checks: toggleCheck(cur?.checks ?? [], id) }))}
      />
      <NoteField key={date} day={day} onSave={(note) => save({ note })} />
    </Screen>
  );
}

function NoteField({ day, onSave }: { day?: DayObservation; onSave: (note: string | undefined) => void }) {
  const [value, setValue] = useDebouncedField(day?.note ?? '', (v) => onSave(v.trim() || undefined));
  return (
    <Card title="Примітка">
      <Textarea
        value={value}
        onChangeText={setValue}
        placeholder="Досягнення, труднощі, навички самообслуговування, рекомендації"
        style={{ minHeight: 140 }}
      />
    </Card>
  );
}
