import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown, FileSpreadsheet, FileText, NotebookText } from 'lucide-react';
import { useStudent } from '../../state/student';
import { dataExtent, loadDataset } from '../../db/repo';
import { fmtDate, monthEndISO, monthKey, monthStartISO, todayISO } from '../../domain/dates';
import type { ISODate } from '../../domain/types';
import { downloadBlob, safeFileName } from '../../export/download';
import { buildSheetDays, periodLabel } from '../../export/sheetData';
import { Button, Card, Field, Input, Notice, PageTitle, cx } from '../../components/ui';

type DocType = 'sheet' | 'journal' | 'report' | 'raw';
type Format = 'pdf' | 'docx' | 'xlsx';

const DOCS: { id: DocType; title: string; text: string; icon: typeof FileText; formats: Format[] }[] = [
  { id: 'sheet', title: 'Щоденний аркуш', text: 'Бланк спостережень за один день — як паперовий, з позначками.', icon: NotebookText, formats: ['pdf', 'docx'] },
  { id: 'journal', title: 'Журнал за період', text: 'Щоденні аркуші всіх днів періоду в одному файлі.', icon: FileText, formats: ['pdf', 'docx'] },
  { id: 'report', title: 'Аналітичний звіт', text: 'Висновки, показники по місяцях, графіки, частоти пунктів, примітки.', icon: FileDown, formats: ['pdf', 'docx'] },
  { id: 'raw', title: 'Сирі дані', text: 'Excel з уроками, днями, показниками й частотами — для власного аналізу.', icon: FileSpreadsheet, formats: ['xlsx'] },
];

const FORMAT_LABEL: Record<Format, string> = { pdf: 'PDF', docx: 'Word (DOCX)', xlsx: 'Excel (XLSX)' };

export default function ExportPage() {
  const student = useStudent();
  const [params] = useSearchParams();
  const extent = useLiveQuery(async () => (await dataExtent(student.id)) ?? null, [student.id]);
  if (extent === undefined) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  const today = todayISO();
  const lastDay = extent?.to ?? (today <= student.yearEnd ? today : student.yearEnd);
  const initialType = (params.get('type') as DocType | null) ?? 'sheet';
  return (
    <ExportForm
      initialType={DOCS.some((d) => d.id === initialType) ? initialType : 'sheet'}
      initialDate={lastDay}
      initialFrom={params.get('from') ?? monthStartISO(monthKey(lastDay))}
      initialTo={params.get('to') ?? (monthEndISO(monthKey(lastDay)) > today ? today : monthEndISO(monthKey(lastDay)))}
    />
  );
}

function ExportForm({
  initialType,
  initialDate,
  initialFrom,
  initialTo,
}: {
  initialType: DocType;
  initialDate: ISODate;
  initialFrom: ISODate;
  initialTo: ISODate;
}) {
  const student = useStudent();
  const [type, setType] = useState<DocType>(initialType);
  const doc = DOCS.find((d) => d.id === type)!;
  const [format, setFormat] = useState<Format>(doc.formats[0]);
  const [date, setDate] = useState(initialDate);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  const fmt = doc.formats.includes(format) ? format : doc.formats[0];

  const run = async () => {
    const range = type === 'sheet' ? { from: date, to: date } : { from, to };
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
        `${type === 'report' ? 'Звіт' : type === 'raw' ? 'Дані' : 'Журнал'}_${student.name}_${range.from === range.to ? range.from : `${range.from}_${range.to}`}`,
      );
      let blob: Blob;
      if (type === 'raw') {
        const { rawDataXlsx } = await import('../../export/xlsx/rawDataXlsx');
        blob = rawDataXlsx(ds);
      } else if (type === 'report') {
        const [{ buildReport }, { reportCharts }] = await Promise.all([import('../../export/reportData'), import('../../export/chartImage')]);
        const report = buildReport(ds);
        if (report.analysis.overall.observed === 0 && report.analysis.overall.observedDays === 0) {
          setStatus({ tone: 'warn', text: 'За вибраний період немає заповнених спостережень.' });
          return;
        }
        const charts = await reportCharts(report.analysis);
        const generatedAt = fmtDate(todayISO());
        if (fmt === 'pdf') {
          const { reportPdf } = await import('../../export/pdf/render');
          blob = await reportPdf(student, period, report, charts, generatedAt);
        } else {
          const { reportDocx } = await import('../../export/docx/docx');
          blob = await reportDocx(student, period, report, charts, generatedAt);
        }
      } else {
        const days = buildSheetDays(ds, type === 'journal' && onlyFilled);
        if (!days.length) {
          setStatus({ tone: 'warn', text: 'У вибраному періоді немає днів із даними.' });
          return;
        }
        const title = `Журнал спостережень — ${student.name} — ${period}`;
        if (fmt === 'pdf') {
          const { journalPdf } = await import('../../export/pdf/render');
          blob = await journalPdf(student, days, title);
        } else {
          const { journalDocx } = await import('../../export/docx/docx');
          blob = await journalDocx(student, days, title);
        }
      }
      downloadBlob(blob, `${base}.${fmt}`);
      setStatus({ tone: 'good', text: `Готово: ${base}.${fmt}` });
    } catch (err) {
      console.error(err);
      setStatus({ tone: 'bad', text: `Не вдалося сформувати документ: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Експорт" subtitle="Документи формуються на цьому пристрої — дані нікуди не надсилаються." />
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {DOCS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={type === d.id}
            onClick={() => {
              setType(d.id);
              setStatus(null);
            }}
            className={cx(
              'flex gap-3 rounded-xl p-4 text-left ring-1 transition-colors',
              type === d.id
                ? 'bg-brand-50 ring-2 ring-brand-700 dark:bg-brand-900/30'
                : 'bg-white ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800',
            )}
          >
            <d.icon size={22} className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-200" aria-hidden />
            <span>
              <span className="block font-medium">{d.title}</span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">{d.text}</span>
            </span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          {type === 'sheet' ? (
            <Field label="День" className="w-44">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="З" className="w-44">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="По" className="w-44">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          )}
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Формат</span>
            <div className="flex gap-1">
              {doc.formats.map((f) => (
                <Button key={f} size="sm" variant={fmt === f ? 'primary' : 'secondary'} onClick={() => setFormat(f)} className="h-10">
                  {FORMAT_LABEL[f]}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {type === 'journal' && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)} />
            Лише дні із заповненими спостереженнями або відсутністю
          </label>
        )}
        <Button variant="primary" className="mt-4" disabled={busy} onClick={run}>
          <FileDown size={16} /> {busy ? 'Формую…' : 'Завантажити'}
        </Button>
        {status && (
          <div className="mt-3">
            <Notice tone={status.tone}>{status.text}</Notice>
          </div>
        )}
      </Card>
    </div>
  );
}
