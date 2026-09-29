/**
 * Щоденні аркуші у PDF — копія паперового бланку: сторінка 1 (навчальна діяльність,
 * увага/емоційний стан, поведінка) і сторінка 2 (взаємодія з вчителем і асистентом,
 * комунікативні та соціальні навички, примітка). Понад 5 уроків — наступний аркуш.
 */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import {
  ASSISTANT,
  ATTENTION,
  BEHAVIOR,
  EMOTION,
  HELP_LABEL,
  LEARNING,
  PAPER_HELP_ORDER,
  SOCIAL,
  TEACHER,
  type CategoryDef,
} from '@journal/core';
import type { Student } from '@journal/core';
import { BEIGE, Box, Footer, GREEN, INK, Item, LINE, MUTED, k } from './kit';
import { LESSONS_PER_SHEET, chunk, dayTitle, studentLine, type SheetDay, type SheetLesson } from '@journal/core';

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  title: { fontSize: 11, fontWeight: 'bold' },
  sub: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  date: { fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  table: { borderTopWidth: 0.7, borderLeftWidth: 0.7, borderColor: LINE },
  row: { flexDirection: 'row' },
  cell: { borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: LINE, padding: 3 },
  th: { fontSize: 8, fontWeight: 'bold', textAlign: 'center' },
  lessonNo: { fontSize: 8.5, fontWeight: 'bold' },
  subject: { fontWeight: 'bold', marginTop: 2 },
  muted: { color: MUTED },
  absent: { marginTop: 3, fontWeight: 'bold' },
  absentCell: { color: MUTED, fontStyle: 'normal' },
  sep: { borderBottomWidth: 0.5, borderColor: '#9a9a95', marginVertical: 2.5 },
  caption: { fontSize: 6.8, color: MUTED, marginBottom: 2 },
  label: { fontWeight: 'bold', marginTop: 1.5, marginBottom: 1.5 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 },
  inlineItem: { flexDirection: 'row', alignItems: 'center', marginRight: 5, marginBottom: 1 },
  note: {},
  twoCol: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '50%', paddingRight: 3 },
  backPage: { fontSize: 7.1 },
  noteLine: { borderBottomWidth: 0.5, borderColor: '#b5b4ae', height: 11 },
});

const W1 = { lesson: '19%', learning: '41%', attention: '20%', behavior: '20%' };

function Items({ cat, checks }: { cat: CategoryDef; checks: Set<string> }) {
  return (
    <>
      {cat.items.map((i) => (
        <Item key={i.id} on={checks.has(i.id)}>
          {i.label}
        </Item>
      ))}
    </>
  );
}

function Cell({ width, children, bg }: { width: string; children?: ReactNode; bg?: string }) {
  return <View style={[s.cell, { width }, bg ? { backgroundColor: bg } : {}]}>{children}</View>;
}

function Absent() {
  return <Text style={s.absentCell}>Відсутній на уроці (н)</Text>;
}

function Header({ student, day, part }: { student: Student; day: SheetDay; part: string }) {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.title}>Журнал спостережень асистента вчителя</Text>
        <Text style={s.sub}>{studentLine(student)}</Text>
      </View>
      <View>
        <Text style={s.date}>{dayTitle(day.date)}</Text>
        <Text style={[s.sub, { textAlign: 'right' }]}>{part}</Text>
      </View>
    </View>
  );
}

function LessonInfo({ l }: { l: SheetLesson }) {
  return (
    <View>
      <Text style={s.lessonNo}>Урок {l.lesson.lessonNumber}</Text>
      {l.time && (
        <Text style={s.muted}>
          {l.time.start}–{l.time.end}
        </Text>
      )}
      <Text style={s.subject}>{l.lesson.subject}</Text>
      {l.lesson.topic && <Text style={{ marginTop: 2 }}>Тема: {l.lesson.topic}</Text>}
      {l.lesson.absent && <Text style={s.absent}>{l.lesson.absenceMarker ?? 'н'} — відсутній</Text>}
    </View>
  );
}

function FrontPage({ student, day, lessons, part }: { student: Student; day: SheetDay; lessons: SheetLesson[]; part: string }) {
  return (
    <Page size="A4" style={k.page}>
      <Header student={student} day={day} part={part} />
      <View style={s.table}>
        <View style={s.row}>
          <Cell width={W1.lesson} bg={BEIGE}>
            <Text style={s.th}>Урок / тема</Text>
          </Cell>
          <Cell width={W1.learning} bg={GREEN}>
            <Text style={s.th}>Навчальна діяльність</Text>
          </Cell>
          <Cell width={W1.attention} bg={GREEN}>
            <Text style={s.th}>Увага / Емоційний стан</Text>
          </Cell>
          <Cell width={W1.behavior} bg={GREEN}>
            <Text style={s.th}>Поведінка</Text>
          </Cell>
        </View>
        {lessons.map((l) => {
          const checks = new Set(l.obs?.checks ?? []);
          const absent = !!l.lesson.absent;
          return (
            <View key={l.lesson.id} style={s.row} wrap={false}>
              <Cell width={W1.lesson}>
                <LessonInfo l={l} />
              </Cell>
              <Cell width={W1.learning}>{absent ? <Absent /> : <Items cat={LEARNING} checks={checks} />}</Cell>
              <Cell width={W1.attention}>
                {absent ? (
                  <Absent />
                ) : (
                  <>
                    <Items cat={ATTENTION} checks={checks} />
                    {l.obs?.attentionMinutes != null && <Text style={{ marginBottom: 1.5 }}>Утримує увагу: {l.obs.attentionMinutes} хв</Text>}
                    <View style={s.sep} />
                    <Items cat={EMOTION} checks={checks} />
                  </>
                )}
              </Cell>
              <Cell width={W1.behavior}>{absent ? <Absent /> : <Items cat={BEHAVIOR} checks={checks} />}</Cell>
            </View>
          );
        })}
        {!lessons.length && (
          <View style={s.row}>
            <Cell width="100%">
              <Text style={s.muted}>Уроків цього дня немає.</Text>
            </Cell>
          </View>
        )}
      </View>
      <Footer left={`${student.name} · ${dayTitle(day.date)}`} />
    </Page>
  );
}

function AssistantCell({ l }: { l: SheetLesson }) {
  const checks = new Set(l.obs?.checks ?? []);
  const [org, ...adaptations] = ASSISTANT.items;
  return (
    <View>
      <Text style={s.label}>Допомога асистента була потрібна:</Text>
      <View style={s.inline}>
        {PAPER_HELP_ORDER.map((h) => (
          <View key={h} style={s.inlineItem}>
            <Box on={l.obs?.helpLevel === h} />
            <Text>{HELP_LABEL[h]}</Text>
          </View>
        ))}
      </View>
      <Item on={checks.has(org.id)}>{org.label}</Item>
      <Text style={s.label}>Адаптація:</Text>
      {/* Як на паперовому бланку — по два пункти в рядку. */}
      <View style={s.twoCol}>
        {adaptations.map((i) => (
          <View key={i.id} style={s.half}>
            <Item on={checks.has(i.id)}>{i.label}</Item>
          </View>
        ))}
      </View>
      {l.obs?.comment && <Text style={{ marginTop: 2 }}>Коментар: {l.obs.comment}</Text>}
    </View>
  );
}

function BackPage({
  student,
  day,
  lessons,
  part,
  withSocial,
}: {
  student: Student;
  day: SheetDay;
  lessons: SheetLesson[];
  part: string;
  withSocial: boolean;
}) {
  const social = new Set(day.day?.checks ?? []);
  let prevSection: string | undefined;
  return (
    <Page size="A4" style={[k.page, s.backPage]}>
      <Header student={student} day={day} part={part} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={[s.table, { width: '72%' }]}>
          <View style={s.row}>
            <Cell width="100%" bg={GREEN}>
              <Text style={s.th}>Взаємодія</Text>
            </Cell>
          </View>
          <View style={s.row}>
            <Cell width="42%" bg={GREEN}>
              <Text style={s.th}>з вчителем</Text>
            </Cell>
            <Cell width="58%" bg={GREEN}>
              <Text style={s.th}>з асистентом вчителя</Text>
            </Cell>
          </View>
          {lessons.map((l) => {
            const checks = new Set(l.obs?.checks ?? []);
            return (
              <View key={l.lesson.id} style={s.row} wrap={false}>
                <Cell width="42%">
                  <Text style={s.caption}>
                    Урок {l.lesson.lessonNumber} · {l.lesson.subject}
                  </Text>
                  {l.lesson.absent ? <Absent /> : <Items cat={TEACHER} checks={checks} />}
                </Cell>
                <Cell width="58%">{l.lesson.absent ? <Absent /> : <AssistantCell l={l} />}</Cell>
              </View>
            );
          })}
        </View>
        <View style={[s.table, { width: '28%', borderLeftWidth: 0 }]}>
          <Cell width="100%" bg={BEIGE}>
            <Text style={s.th}>Комунікативні та соціальні навички</Text>
          </Cell>
          <Cell width="100%">
            {withSocial ? (
              SOCIAL.items.map((i) => {
                const heading = i.section && i.section !== prevSection ? i.section : undefined;
                prevSection = i.section;
                return (
                  <View key={i.id}>
                    {heading && <Text style={s.label}>{heading}:</Text>}
                    <Item on={social.has(i.id)}>{i.label}</Item>
                  </View>
                );
              })
            ) : (
              <Text style={s.muted}>Див. перший аркуш цього дня.</Text>
            )}
          </Cell>
          <Cell width="100%" bg={GREEN}>
            <Text style={s.th}>Примітка</Text>
            <Text style={{ fontSize: 6, textAlign: 'center', color: INK }}>
              (досягнення, труднощі, навички самообслуговування, рекомендації)
            </Text>
          </Cell>
          <Cell width="100%">
            {withSocial && day.day?.note ? (
              <Text style={s.note}>{day.day.note}</Text>
            ) : (
              Array.from({ length: 8 }, (_, i) => <View key={i} style={s.noteLine} />)
            )}
          </Cell>
        </View>
      </View>
      <Footer left={`${student.name} · ${dayTitle(day.date)}`} />
    </Page>
  );
}

export function JournalDocument({ student, days, title }: { student: Student; days: SheetDay[]; title: string }) {
  return (
    <Document title={title} author={student.assistantName || 'Асистент вчителя'} subject="Журнал спостережень асистента вчителя" language="uk">
      {days.flatMap((day) => {
        const sheets = chunk(day.lessons, LESSONS_PER_SHEET);
        return sheets.flatMap((lessons, i) => {
          const part = sheets.length > 1 ? `аркуш ${i + 1} з ${sheets.length}` : '';
          return [
            <FrontPage key={`${day.date}-${i}-f`} student={student} day={day} lessons={lessons} part={part} />,
            <BackPage key={`${day.date}-${i}-b`} student={student} day={day} lessons={lessons} part={part ? `${part} · зворот` : 'зворот'} withSocial={i === 0} />,
          ];
        });
      })}
    </Document>
  );
}
