import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardList, Plus } from 'lucide-react-native';
import {
  addDaysISO,
  addManualLesson,
  dataExtent,
  eachDate,
  fmtDate,
  getLessonsForRange,
  hasDayData,
  hasObservationData,
  isoWeekday,
  lessonTime,
  listDayObs,
  listHolidays,
  listLessonObs,
  listSlots,
  setAbsent,
  todayISO,
  useQuery,
  useRepo,
  weekEndISO,
  weekStartISO,
  WEEKDAYS_SHORT,
  type ISODate,
  type Lesson,
  type LessonObservation,
  type Student,
} from '@journal/core';
import { Badge, Button, Card, Field, Input, Notice, PageTitle, Select } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { useStudents } from '@/state/student';
import { TAP, font, radius, sp, useTheme, type Theme } from '@/theme';

type DayStatus = 'none' | 'empty' | 'partial' | 'full' | 'absent';

function dayStatus(lessons: Lesson[], obs: Map<string, LessonObservation>): DayStatus {
  if (!lessons.length) return 'none';
  const attended = lessons.filter((l) => !l.absent);
  if (!attended.length) return 'absent';
  const filled = attended.filter((l) => hasObservationData(obs.get(l.id))).length;
  return filled === 0 ? 'empty' : filled === attended.length ? 'full' : 'partial';
}

const dot = (t: Theme, s: DayStatus): string =>
  ({ none: 'transparent', empty: t.ring, partial: '#f59e0b', full: '#10b981', absent: '#fb7185' })[s];

export function TodayScreen() {
  const { student } = useStudents();
  const params = useLocalSearchParams<{ d?: string }>();
  const extent = useRepo(dataExtent, student?.id ?? '');
  const today = todayISO();

  if (!student) return null;
  const inYear = today >= student.yearStart && today <= student.yearEnd;
  const date: ISODate | undefined =
    params.d ?? (inYear ? today : extent === undefined ? undefined : (extent?.to ?? student.yearStart));

  if (!date) return null;
  return <DayView key={student.id} student={student} date={date} fallback={!params.d && !inYear} />;
}

function DayView({ student, date, fallback }: { student: Student; date: ISODate; fallback: boolean }) {
  const t = useTheme();
  const weekStart = weekStartISO(date);
  const weekEnd = weekEndISO(date);
  const onDate = (d: ISODate) => router.setParams({ d });

  const week = useQuery(
    async () => {
      const [lessons, obs, days, slots, holidays] = await Promise.all([
        getLessonsForRange(student, weekStart, weekEnd),
        listLessonObs(student.id, weekStart, weekEnd),
        listDayObs(student.id, weekStart, weekEnd),
        listSlots(student.id),
        listHolidays(student.id),
      ]);
      return { lessons, obs: new Map(obs.map((o) => [o.id, o])), days, slots, holidays };
    },
    ['lessons', 'timetable', 'holidays', 'lessonObs', 'dayObs'],
    [student.id, weekStart, weekEnd],
  );

  if (!week) return null;

  const weekendUsed = week.slots.some((s) => s.weekday >= 6) || week.lessons.some((l) => isoWeekday(l.date) >= 6);
  const days = eachDate(weekStart, weekEnd).filter((d) => weekendUsed || isoWeekday(d) <= 5);
  const lessons = week.lessons.filter((l) => l.date === date);
  const dayObs = week.days.find((d) => d.date === date);
  const holiday = week.holidays.find((h) => h.from <= date && date <= h.to);
  const outOfYear = date < student.yearStart || date > student.yearEnd;

  return (
    <Screen>
      <PageTitle
        title={fmtDate(date, 'EEEE, d MMMM')}
        subtitle={`${student.name}${student.className ? ` · ${student.className}` : ''}`}
        actions={
          date !== todayISO() ? (
            <Button size="sm" onPress={() => onDate(todayISO())}>
              Сьогодні
            </Button>
          ) : undefined
        }
      />

      {fallback && <Notice tone="info">Сьогодні поза межами навчального року — показано останній день з даними.</Notice>}

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Arrow label="Попередній тиждень" onPress={() => onDate(addDaysISO(weekStart, -7))}>
          <ChevronLeft color={t.muted} size={20} />
        </Arrow>
        <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
          {days.map((d) => {
            const on = d === date;
            const st = dayStatus(
              week.lessons.filter((l) => l.date === d),
              week.obs,
            );
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onDate(d)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: sp.sm,
                  borderRadius: radius.sm,
                  backgroundColor: on ? t.brand : 'transparent',
                }}
              >
                <Text style={{ fontSize: 11, color: on ? t.onBrand : t.muted }}>{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</Text>
                <Text style={{ fontSize: font.sm, fontWeight: '700', color: on ? t.onBrand : t.text }}>
                  {Number(d.slice(8))}
                </Text>
                <View style={{ marginTop: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: dot(t, st) }} />
              </Pressable>
            );
          })}
        </View>
        <Arrow label="Наступний тиждень" onPress={() => onDate(addDaysISO(weekStart, 7))}>
          <ChevronRight color={t.muted} size={20} />
        </Arrow>
      </View>

      <View style={{ gap: sp.sm }}>
        {lessons.map((l) => (
          <LessonRow key={l.id} student={student} lesson={l} obs={week.obs.get(l.id)} date={date} />
        ))}

        {!lessons.length && (
          <Card>
            <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
              {outOfYear
                ? 'Дата поза межами навчального року (змініть межі в налаштуваннях профілю).'
                : holiday
                  ? `Канікули: ${holiday.title}.`
                  : isoWeekday(date) >= 6
                    ? 'Вихідний день.'
                    : week.slots.length
                      ? 'За розкладом уроків немає.'
                      : 'Розклад ще не заповнено.'}
            </Text>
            {!week.slots.length && (
              <Button style={{ marginTop: sp.md }} onPress={() => router.push('/schedule')}>
                Заповнити тижневий розклад
              </Button>
            )}
          </Card>
        )}
      </View>

      {lessons.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: sp.md,
            padding: sp.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <ClipboardList color={t.brandInk} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: font.md, fontWeight: '600' }}>Підсумок дня</Text>
            <Text style={{ color: t.muted, fontSize: font.xs }}>Комунікативні та соціальні навички, примітка</Text>
          </View>
          <Badge tone={hasDayData(dayObs) ? 'good' : 'neutral'}>{hasDayData(dayObs) ? 'Заповнено' : 'Не заповнено'}</Badge>
        </Pressable>
      )}

      {!outOfYear && <AddLesson student={student} date={date} taken={lessons.map((l) => l.lessonNumber)} />}
    </Screen>
  );
}

function Arrow({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 36, height: TAP, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </Pressable>
  );
}

function LessonRow({
  student,
  lesson,
  obs,
  date,
}: {
  student: Student;
  lesson: Lesson;
  obs?: LessonObservation;
  date: ISODate;
}) {
  const t = useTheme();
  const time = lessonTime(student, lesson.lessonNumber);
  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.surface,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/day/[date]/lesson/[n]', params: { date, n: String(lesson.lessonNumber) } })
        }
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: sp.md,
          padding: sp.md,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.brandSoft,
          }}
        >
          <Text style={{ color: t.brandInk, fontWeight: '700' }}>{lesson.lessonNumber}</Text>
        </View>
        {/* Назва предмета — головне в рядку, тож час і стан ідуть окремим стовпцем. */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.text, fontSize: font.md, fontWeight: '600' }} numberOfLines={1}>
            {lesson.subject}
          </Text>
          <Text style={{ color: t.muted, fontSize: font.sm }} numberOfLines={1}>
            {lesson.topic || 'Тема не вказана'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          {time && (
            <Text style={{ color: t.muted, fontSize: font.xs }}>
              {time.start}–{time.end}
            </Text>
          )}
          {lesson.absent ? (
            <Badge tone="warn">н — відсутній</Badge>
          ) : hasObservationData(obs) ? (
            <Badge tone="good">Заповнено</Badge>
          ) : (
            <Badge>Не заповнено</Badge>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Позначити відсутність"
        accessibilityState={{ checked: !!lesson.absent }}
        onPress={() => setAbsent(lesson, !lesson.absent)}
        style={{
          width: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderLeftWidth: 1,
          borderLeftColor: t.line,
          backgroundColor: lesson.absent ? t.tones.warn.bg : 'transparent',
        }}
      >
        <Text style={{ color: lesson.absent ? t.tones.warn.fg : t.muted, fontSize: font.md, fontWeight: '700' }}>н</Text>
      </Pressable>
    </View>
  );
}

function AddLesson({ student, date, taken }: { student: Student; date: ISODate; taken: number[] }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const free = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => !taken.includes(n));
  const [n, setN] = useState(String(free[0] ?? 1));
  const [subject, setSubject] = useState('');

  if (!open)
    return (
      <Button variant="ghost" size="sm" icon={<Plus color={t.subtle} size={16} />} onPress={() => setOpen(true)}>
        Додати урок на цей день
      </Button>
    );

  return (
    <Card title="Додатковий урок">
      <View style={{ gap: sp.md }}>
        <Field label="Урок №">
          <Select value={n} options={free.map((x) => ({ id: String(x), label: String(x) }))} onChange={setN} />
        </Field>
        <Field label="Предмет">
          <Input value={subject} onChangeText={setSubject} placeholder="Напр. Математика" autoFocus />
        </Field>
        <Button
          variant="primary"
          disabled={!subject.trim()}
          onPress={async () => {
            await addManualLesson(student, date, Number(n), subject.trim());
            setSubject('');
            setOpen(false);
          }}
        >
          Додати
        </Button>
        <Button variant="ghost" onPress={() => setOpen(false)}>
          Скасувати
        </Button>
      </View>
    </Card>
  );
}
