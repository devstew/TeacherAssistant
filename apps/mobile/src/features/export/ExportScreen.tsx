import { useState } from 'react';
import { Text, View } from 'react-native';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet, FileText, NotebookText } from 'lucide-react-native';
import {
  XLSX_MIME,
  blankSheetDay,
  buildReport,
  buildSheetDays,
  dataExtent,
  fmtDate,
  loadDataset,
  monthEndISO,
  monthKey,
  monthStartISO,
  periodLabel,
  rawDataWorkbook,
  reportHtml,
  safeFileName,
  sheetHtml,
  todayISO,
  useRepo,
  type ISODate,
} from '@journal/core';
import { Button, Card, Field, Notice, PageTitle, Segmented } from '@/components/ui';
import { DateField } from '@/components/fields';
import { Screen } from '@/components/Screen';
import { shareBase64, sharePdf } from '@/export/documents';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

type DocType = 'sheet' | 'journal' | 'report' | 'raw';

const DOCS: { id: DocType; title: string; text: string; format: string }[] = [
  { id: 'sheet', title: 'Щоденний аркуш', text: 'Бланк спостережень за один день — як паперовий, з позначками.', format: 'PDF' },
  { id: 'journal', title: 'Журнал за період', text: 'Щоденні аркуші всіх днів періоду в одному файлі.', format: 'PDF' },
  { id: 'report', title: 'Аналітичний звіт', text: 'Висновки, показники по місяцях, графіки, частоти пунктів, примітки.', format: 'PDF' },
  { id: 'raw', title: 'Сирі дані', text: 'Excel з уроками, днями, показниками й частотами — для власного аналізу.', format: 'XLSX' },
];

const ICONS: Record<DocType, typeof FileText> = {
  sheet: NotebookText,
  journal: FileText,
  report: FileDown,
  raw: FileSpreadsheet,
};

export function ExportScreen() {
  const t = useTheme();
  const { student } = useStudents();
  const extent = useRepo(dataExtent, student?.id ?? '');
  const [type, setType] = useState<DocType>('sheet');
  const [date, setDate] = useState<ISODate | null>(null);
  const [from, setFrom] = useState<ISODate | null>(null);
  const [to, setTo] = useState<ISODate | null>(null);
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);

  if (!student || extent === undefined) return null;

  const today = todayISO();
  const lastDay = extent?.to ?? (today <= student.yearEnd ? today : student.yearEnd);
  const day = date ?? lastDay;
  const rangeFrom = from ?? monthStartISO(monthKey(lastDay));
  const rangeTo = to ?? (monthEndISO(monthKey(lastDay)) > today ? today : monthEndISO(monthKey(lastDay)));
  const doc = DOCS.find((d) => d.id === type)!;
  const Icon = ICONS[type];
  const years = [Number(student.yearStart.slice(0, 4)), Number(student.yearEnd.slice(0, 4))].filter(
    (y, i, a) => a.indexOf(y) === i,
  );

  const run = async () => {
    const range = type === 'sheet' ? { from: day, to: day } : { from: rangeFrom, to: rangeTo };
    if (range.from > range.to) {
      setStatus({ tone: 'bad', text: 'Дата початку пізніша за дату завершення.' });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const ds = await loadDataset(student, range.from, range.to);
      const period = periodLabel(range.from, range.to);
      const base = safeFileName(
        `${type === 'report' ? 'Звіт' : type === 'raw' ? 'Дані' : 'Журнал'}_${student.name}_${
          range.from === range.to ? range.from : `${range.from}_${range.to}`
        }`,
      );

      if (type === 'raw') {
        const wb = rawDataWorkbook(ds);
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
        const name = await shareBase64(base64, base, 'xlsx', XLSX_MIME);
        setStatus({ tone: 'good', text: `Готово: ${name}` });
      } else if (type === 'report') {
        const report = buildReport(ds);
        if (report.analysis.overall.observed === 0 && report.analysis.overall.observedDays === 0) {
          setStatus({ tone: 'warn', text: 'За вибраний період немає заповнених спостережень.' });
          return;
        }
        const name = await sharePdf(reportHtml(student, period, report, fmtDate(today)), base);
        setStatus({ tone: 'good', text: `Готово: ${name}` });
      } else {
        let days = buildSheetDays(ds, type === 'journal' && onlyFilled);
        // Для одного дня без уроків друкуємо порожній бланк — його заповнюють від руки.
        if (!days.length && type === 'sheet') days = [blankSheetDay(student, range.from)];
        if (!days.length) {
          setStatus({ tone: 'warn', text: 'У вибраному періоді немає днів із даними.' });
          return;
        }
        const title = `Журнал спостережень — ${student.name} — ${period}`;
        const name = await sharePdf(sheetHtml(student, days, title), base);
        setStatus({ tone: 'good', text: `Готово: ${name}` });
      }
    } catch (e) {
      setStatus({ tone: 'bad', text: e instanceof Error ? e.message : 'Не вдалося створити документ.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageTitle title="Експорт" subtitle="Документи для школи — з того самого журналу." />

      <Card title="Що формуємо">
        <View style={{ gap: sp.md }}>
          <Segmented
            label="Тип документа"
            options={[
              { id: 'sheet', label: 'Аркуш' },
              { id: 'journal', label: 'Журнал' },
              { id: 'report', label: 'Звіт' },
              { id: 'raw', label: 'Excel' },
            ]}
            value={type}
            onChange={(v) => v && setType(v as DocType)}
          />
          <View style={{ flexDirection: 'row', gap: sp.sm, alignItems: 'flex-start' }}>
            <Icon color={t.brandInk} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: font.md, fontWeight: '600' }}>{doc.title}</Text>
              <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>{doc.text}</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card title={type === 'sheet' ? 'День' : 'Період'}>
        <View style={{ gap: sp.md }}>
          {type === 'sheet' ? (
            <Field label="Дата">
              <DateField label="Дата" value={day} years={years} onChange={setDate} />
            </Field>
          ) : (
            <>
              <Field label="З">
                <DateField label="Початок" value={rangeFrom} years={years} onChange={setFrom} />
              </Field>
              <Field label="По">
                <DateField label="Кінець" value={rangeTo} years={years} onChange={setTo} />
              </Field>
            </>
          )}
          {type === 'journal' && (
            <Field label="Які дні друкувати">
              <Segmented
                label="Які дні друкувати"
                options={[
                  { id: 'filled', label: 'Лише заповнені' },
                  { id: 'all', label: 'Усі дні' },
                ]}
                value={onlyFilled ? 'filled' : 'all'}
                onChange={(v) => v && setOnlyFilled(v === 'filled')}
              />
            </Field>
          )}
          <Button variant="primary" disabled={busy} onPress={run}>
            {busy ? 'Формую…' : `Створити ${doc.format} і поділитися`}
          </Button>
          {status && <Notice tone={status.tone}>{status.text}</Notice>}
          <Text style={{ color: t.muted, fontSize: font.xs }}>
            Готовий файл відкриється в системному вікні «Поділитися»: надішліть його поштою чи в месенджер або збережіть
            у «Файли».
          </Text>
        </View>
      </Card>

      <Card title="Word (DOCX)">
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Документи Word створює лише веб-версія: бібліотека для DOCX потребує можливостей браузера, яких на телефоні
          немає. Для школи PDF із телефона рівноцінний, а якщо документ треба редагувати — відкрийте журнал у браузері.
        </Text>
      </Card>
    </Screen>
  );
}
