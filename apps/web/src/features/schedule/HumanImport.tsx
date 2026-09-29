import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import { useStudent } from '../../state/student';
import { useQuery, useRepo } from '@journal/core';
import { getLessonsForRange, listSlots, saveStudent } from '@journal/core';
import { fmtDate } from '@journal/core';
import type { Lesson } from '@journal/core';
import { Badge, Button, Card, Field, Input, Notice, Select } from '../../components/ui';
import { parseAttendanceWorkbook, readWorkbook, type AttendanceParseResult } from '@journal/core';
import { parseTopicsWorkbook, planTopicAssignment, type TopicsParseResult } from '@journal/core';
import { applyAbsences, applyTopics, type AbsenceApplyResult } from '../../integrations/human/apply';

export default function HumanImport() {
  return (
    <div className="space-y-4">
      <Notice tone="info">
        <p className="font-medium">Чому файли, а не пряме підключення</p>
        <p className="mt-1">
          У Human немає відкритого API для сторонніх застосунків, а дані через «Мрію» третім сторонам недоступні. Тому
          відсутності й теми переносимо з файлів, які Human уже вміє вивантажувати. Перед записом усе показується на попередньому
          перегляді.
        </p>
      </Notice>
      <AttendanceImport />
      <TopicsImport />
    </div>
  );
}

function FilePicker({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800">
      <FileSpreadsheet size={16} aria-hidden /> {label}
      <input
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function AttendanceImport() {
  const student = useStudent();
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState(student.humanName || student.name);
  const [month, setMonth] = useState('');
  const [result, setResult] = useState<AbsenceApplyResult | null>(null);
  const [error, setError] = useState('');

  const parsed: AttendanceParseResult | null = useMemo(
    () => (wb ? parseAttendanceWorkbook(wb, { studentName: name, schoolYearStart: student.yearStart, month: month || undefined }) : null),
    [wb, name, month, student.yearStart],
  );

  return (
    <Card title="Відсутності («н») з Excel">
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>
          У Human: <b>Простори → Мій клас → Журнал → «Облік відвідування» → Завантажити → Excel</b> (за місяць; доступно класному
          керівнику) або <b>Аналітика → «Експорт відвідуваності в Excel»</b>.
        </li>
        <li>Завантажте файл сюди, перевірте список і натисніть «Записати».</li>
      </ol>
      <FilePicker
        label={fileName || 'Вибрати файл відвідуваності'}
        onFile={async (f) => {
          setError('');
          setResult(null);
          try {
            setWb(readWorkbook(await f.arrayBuffer()));
            setFileName(f.name);
          } catch {
            setError('Не вдалося прочитати файл. Потрібен .xlsx, .xls або .csv.');
          }
        }}
      />
      {error && (
        <div className="mt-3">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}

      {parsed && (
        <div className="mt-4 space-y-3">
          {parsed.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Учень у файлі" className="min-w-56 flex-1">
              {parsed.matchedName ? (
                <div className="flex h-10 items-center gap-2 text-sm">
                  <Badge tone="good">Знайдено</Badge> {parsed.matchedName}
                  {parsed.sheet && <span className="text-slate-500">· аркуш «{parsed.sheet}»</span>}
                </div>
              ) : (
                <Select value="" onChange={(e) => setName(e.target.value)}>
                  <option value="">— оберіть зі списку —</option>
                  {parsed.candidates.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {(parsed.needsMonth || month) && (
              <Field label="Місяць файлу" className="w-44">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </Field>
            )}
          </div>

          {parsed.matchedName && parsed.matchedName !== student.humanName && (
            <Button size="sm" variant="ghost" onClick={() => saveStudent({ ...student, humanName: parsed.matchedName })}>
              Запам'ятати «{parsed.matchedName}» як ім'я дитини в Human
            </Button>
          )}

          {parsed.matchedName && (
            <>
              {parsed.absences.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1 font-medium">Дата</th>
                        <th className="py-1 font-medium">Позначка</th>
                        <th className="py-1 font-medium">Що буде записано</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsed.absences.map((a, i) => (
                        <tr key={i}>
                          <td className="py-1.5">{fmtDate(a.date, 'EEEEEE, d MMM yyyy')}</td>
                          <td className="py-1.5">
                            <Badge tone="warn">{a.marker}</Badge>
                          </td>
                          <td className="py-1.5 text-slate-600 dark:text-slate-300">
                            {a.lessonNumber
                              ? `урок ${a.lessonNumber}${a.subject ? ` (${a.subject})` : ''}`
                              : a.count != null
                                ? `пропущено уроків: ${a.count} (якщо це всі уроки дня — позначимо весь день)`
                                : 'усі уроки дня'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Notice tone="info">У файлі немає відсутностей для цього учня.</Notice>
              )}
              {parsed.absences.length > 0 && (
                <Button variant="primary" onClick={async () => setResult(await applyAbsences(student, parsed.absences))}>
                  Записати відсутності ({parsed.absences.length})
                </Button>
              )}
            </>
          )}

          {result && (
            <Notice tone="good">
              Позначено «н» на {result.marked} уроках.
              {result.partialDays.length > 0 && (
                <>
                  {' '}
                  Дні з частковою відсутністю (позначте потрібні уроки вручну):{' '}
                  {result.partialDays.map((d) => `${fmtDate(d.date, 'd MMM')} — ${d.count} з ${d.total}`).join('; ')}.
                </>
              )}
              {result.noLessons.length > 0 && <> Без уроків у розкладі: {result.noLessons.map((d) => fmtDate(d, 'd MMM')).join(', ')}.</>}
            </Notice>
          )}
        </div>
      )}
    </Card>
  );
}

function TopicsImport() {
  const student = useStudent();
  const slots = useRepo(listSlots, student.id);
  const subjects = [...new Set(slots?.map((s) => s.subject) ?? [])].sort((a, b) => a.localeCompare(b, 'uk'));
  const [parsed, setParsed] = useState<TopicsParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState<'date' | 'sequence'>('sequence');
  const [startDate, setStartDate] = useState(student.yearStart);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');

  const lessons = useQuery(
    async () => (subject ? (await getLessonsForRange(student, student.yearStart, student.yearEnd)).filter((l) => l.subject === subject) : []),
    getLessonsForRange.tables,
    [student.id, subject],
  );
  const plan = useMemo(
    () => (parsed && lessons ? planTopicAssignment(parsed.topics, lessons as Lesson[], mode, startDate) : []),
    [parsed, lessons, mode, startDate],
  );

  return (
    <Card title="Теми уроків з КТП (Excel)">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Підійде той самий Excel календарно-тематичного планування, який учитель імпортує в Human («Імпорт змісту курсу з Excel»):
        колонка «Тема», за бажанням — «Дата».
      </p>
      <FilePicker
        label={fileName || 'Вибрати файл КТП'}
        onFile={async (f) => {
          setError('');
          setDone(null);
          try {
            const res = parseTopicsWorkbook(readWorkbook(await f.arrayBuffer()), student.yearStart);
            setParsed(res);
            setFileName(f.name);
            setMode(res.hasDates ? 'date' : 'sequence');
          } catch {
            setError('Не вдалося прочитати файл.');
          }
        }}
      />
      {error && (
        <div className="mt-3">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
      {parsed && (
        <div className="mt-4 space-y-3">
          {parsed.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          <p className="text-sm">
            Знайдено тем: <b>{parsed.topics.length}</b>
            {parsed.hasDates && ' (з датами)'}.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Предмет" className="min-w-48 flex-1">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">— оберіть предмет —</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Як розподілити" className="w-56">
              <Select value={mode} onChange={(e) => setMode(e.target.value as 'date' | 'sequence')}>
                <option value="sequence">по черзі, з дати</option>
                <option value="date" disabled={!parsed.hasDates}>
                  за датами з файлу
                </option>
              </Select>
            </Field>
            {mode === 'sequence' && (
              <Field label="Перший урок з" className="w-44">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            )}
          </div>
          {!subjects.length && <Notice tone="warn">Спершу заповніть тижневий розклад — теми прив'язуються до уроків предмета.</Notice>}
          {subject && (
            <>
              <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-800">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {plan.map((p) => (
                      <tr key={p.lesson.id}>
                        <td className="w-40 px-3 py-1.5 whitespace-nowrap text-slate-500">
                          {fmtDate(p.lesson.date, 'EEEEEE, d MMM')} · {p.lesson.lessonNumber} ур.
                        </td>
                        <td className="px-3 py-1.5">
                          {p.topic}
                          {p.lesson.topic && p.lesson.topic !== p.topic && (
                            <span className="block text-xs text-amber-700 dark:text-amber-300">замінить: {p.lesson.topic}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!plan.length && (
                      <tr>
                        <td className="px-3 py-2 text-slate-500">Немає уроків, на які можна розподілити теми.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {plan.length > 0 && (
                <Button variant="primary" onClick={async () => setDone(await applyTopics(plan))}>
                  Записати теми ({plan.length})
                </Button>
              )}
            </>
          )}
          {done != null && <Notice tone="good">Записано тем: {done}.</Notice>}
        </div>
      )}
    </Card>
  );
}
