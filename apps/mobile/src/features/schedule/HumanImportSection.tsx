import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { FileSpreadsheet } from 'lucide-react-native';
import type { WorkBook } from 'xlsx';
import {
  applyAbsences,
  applyTopics,
  fmtDate,
  getLessonsForRange,
  listSlots,
  parseAttendanceWorkbook,
  parseTopicsWorkbook,
  planTopicAssignment,
  readWorkbook,
  saveStudent,
  useRepo,
  type AbsenceApplyResult,
  type AttendanceParseResult,
  type Student,
  type TopicsParseResult,
} from '@journal/core';
import { Badge, Button, Card, Field, Notice, Segmented, Select } from '@/components/ui';
import { DateField } from '@/components/fields';
import { font, sp, useTheme } from '@/theme';

const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  '*/*',
];

/** Файл із Human читаємо в base64 — SheetJS розуміє цей формат без Buffer. */
async function pickWorkbook(): Promise<{ wb: WorkBook; name: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: EXCEL_TYPES, copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  const base64 = await new File(asset.uri).base64();
  return { wb: readWorkbook(base64), name: asset.name };
}

export function HumanImportSection({ student }: { student: Student }) {
  const t = useTheme();
  return (
    <View style={{ gap: sp.lg }}>
      <Notice tone="info">
        У Human немає відкритого API для сторонніх застосунків, тому відсутності й теми переносимо з файлів, які Human
        уміє вивантажувати. Перед записом усе показується на попередньому перегляді.
      </Notice>
      <AttendanceImport student={student} />
      <TopicsImport student={student} />
      <Text style={{ color: t.muted, fontSize: font.xs }}>
        Файл спершу збережіть на телефон (у Human або з пошти), потім виберіть його тут.
      </Text>
    </View>
  );
}

function AttendanceImport({ student }: { student: Student }) {
  const t = useTheme();
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState(student.humanName || student.name);
  const [result, setResult] = useState<AbsenceApplyResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed: AttendanceParseResult | null = useMemo(
    () => (wb ? parseAttendanceWorkbook(wb, { studentName: name, schoolYearStart: student.yearStart }) : null),
    [wb, name, student.yearStart],
  );

  const pick = async () => {
    setError('');
    setResult(null);
    try {
      const picked = await pickWorkbook();
      if (!picked) return;
      setWb(picked.wb);
      setFileName(picked.name);
    } catch {
      setError('Не вдалося прочитати файл. Потрібен .xlsx, .xls або .csv.');
    }
  };

  return (
    <Card title="Відсутності («н») з Excel">
      <View style={{ gap: sp.md }}>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          У Human: Простори → Мій клас → Журнал → «Облік відвідування» → Завантажити → Excel.
        </Text>
        <Button icon={<FileSpreadsheet color={t.subtle} size={16} />} onPress={pick}>
          {fileName || 'Вибрати файл відвідуваності'}
        </Button>
        {error !== '' && <Notice tone="bad">{error}</Notice>}

        {parsed && (
          <>
            {parsed.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}

            {parsed.matchedName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm, flexWrap: 'wrap' }}>
                <Badge tone="good">Знайдено</Badge>
                <Text style={{ color: t.text, fontSize: font.sm }}>{parsed.matchedName}</Text>
                {parsed.sheet && <Text style={{ color: t.muted, fontSize: font.xs }}>· аркуш «{parsed.sheet}»</Text>}
              </View>
            ) : (
              <Field label="Учень у файлі">
                <Select
                  label="Учень у файлі"
                  value={undefined}
                  placeholder="— оберіть зі списку —"
                  options={parsed.candidates.map((c) => ({ id: c, label: c }))}
                  onChange={setName}
                />
              </Field>
            )}

            {parsed.matchedName && parsed.matchedName !== student.humanName && (
              <Button size="sm" variant="ghost" onPress={() => saveStudent({ ...student, humanName: parsed.matchedName })}>
                Запам'ятати «{parsed.matchedName}» як ім'я в Human
              </Button>
            )}

            {parsed.matchedName &&
              (parsed.absences.length ? (
                <View style={{ gap: sp.xs }}>
                  {parsed.absences.slice(0, 8).map((a, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                      <Text style={{ color: t.text, fontSize: font.sm, flex: 1 }}>{fmtDate(a.date, 'EEEEEE, d MMM')}</Text>
                      <Badge tone="warn">{a.marker}</Badge>
                      <Text style={{ color: t.muted, fontSize: font.xs, width: 110, textAlign: 'right' }}>
                        {a.lessonNumber ? `урок ${a.lessonNumber}` : a.count != null ? `уроків: ${a.count}` : 'весь день'}
                      </Text>
                    </View>
                  ))}
                  {parsed.absences.length > 8 && (
                    <Text style={{ color: t.muted, fontSize: font.xs }}>…і ще {parsed.absences.length - 8}</Text>
                  )}
                  <Button
                    variant="primary"
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      setResult(await applyAbsences(student, parsed.absences));
                      setBusy(false);
                    }}
                  >
                    {`Записати відсутності (${parsed.absences.length})`}
                  </Button>
                </View>
              ) : (
                <Notice tone="info">У файлі немає відсутностей для цього учня.</Notice>
              ))}

            {result && (
              <Notice tone="good">
                {`Позначено «н» на ${result.marked} уроках.` +
                  (result.partialDays.length
                    ? ` Дні з частковою відсутністю (позначте вручну): ${result.partialDays
                        .map((d) => `${fmtDate(d.date, 'd MMM')} — ${d.count} з ${d.total}`)
                        .join('; ')}.`
                    : '') +
                  (result.noLessons.length
                    ? ` Без уроків у розкладі: ${result.noLessons.map((d) => fmtDate(d, 'd MMM')).join(', ')}.`
                    : '')}
              </Notice>
            )}
          </>
        )}
      </View>
    </Card>
  );
}

function TopicsImport({ student }: { student: Student }) {
  const t = useTheme();
  const slots = useRepo(listSlots, student.id);
  const subjects = [...new Set(slots?.map((s) => s.subject) ?? [])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'uk'));
  const [parsed, setParsed] = useState<TopicsParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState<'date' | 'sequence'>('sequence');
  const [startDate, setStartDate] = useState(student.yearStart);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');
  const years = [Number(student.yearStart.slice(0, 4)), Number(student.yearEnd.slice(0, 4))].filter(
    (y, i, a) => a.indexOf(y) === i,
  );

  const apply = async () => {
    if (!parsed || !subject) return;
    const lessons = (await getLessonsForRange(student, student.yearStart, student.yearEnd)).filter(
      (l) => l.subject === subject,
    );
    const plan = planTopicAssignment(parsed.topics, lessons, mode, mode === 'sequence' ? startDate : undefined);
    setDone(await applyTopics(plan));
  };

  return (
    <Card title="Теми уроків (КТП) з Excel">
      <View style={{ gap: sp.md }}>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Підійде календарно-тематичний план або вивантажені теми з журналу — файл зі стовпцем «Тема».
        </Text>
        <Button
          icon={<FileSpreadsheet color={t.subtle} size={16} />}
          onPress={async () => {
            setError('');
            setDone(null);
            try {
              const picked = await pickWorkbook();
              if (!picked) return;
              setParsed(parseTopicsWorkbook(picked.wb, student.yearStart));
              setFileName(picked.name);
            } catch {
              setError('Не вдалося прочитати файл.');
            }
          }}
        >
          {fileName || 'Вибрати файл із темами'}
        </Button>
        {error !== '' && <Notice tone="bad">{error}</Notice>}

        {parsed && (
          <>
            {parsed.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
            <Text style={{ color: t.subtle, fontSize: font.sm }}>
              Знайдено тем: {parsed.topics.length}
              {parsed.hasDates ? ' (з датами)' : ''}
            </Text>
            <Field label="Предмет">
              <Select
                label="Предмет"
                value={subject || undefined}
                placeholder="— виберіть предмет —"
                options={subjects.map((s) => ({ id: s, label: s }))}
                onChange={setSubject}
              />
            </Field>
            <Field label="Як розкласти теми">
              <Segmented
                label="Як розкласти теми"
                options={[
                  { id: 'sequence', label: 'По черзі' },
                  ...(parsed.hasDates ? [{ id: 'date', label: 'За датами' }] : []),
                ]}
                value={mode}
                onChange={(v) => v && setMode(v as typeof mode)}
              />
            </Field>
            {mode === 'sequence' && (
              <Field label="Починаючи з дати">
                <DateField label="Початок" value={startDate} years={years} onChange={setStartDate} />
              </Field>
            )}
            <Button variant="primary" disabled={!subject || !parsed.topics.length} onPress={apply}>
              Записати теми
            </Button>
            {done != null && <Notice tone="good">Записано тем: {done}.</Notice>}
          </>
        )}
      </View>
    </Card>
  );
}
