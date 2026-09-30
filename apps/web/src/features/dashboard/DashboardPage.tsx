import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, FileDown, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { useStudent } from '../../state/student';
import { useQuery, useRepo } from '@journal/core';
import { dataExtent, loadDataset, type Dataset } from '@journal/core';
import { analyze, weeklyTrend, type Analysis } from '@journal/core';
import { METRIC_LABELS, delta, type Bucket, type Grouping, type MetricId } from '@journal/core';
import { fmtDelta, type Insight } from '@journal/core';
import { CATEGORIES, HELP_LEVELS } from '@journal/core';
import { MONTHS_INS, MONTHS_SHORT, fmtDate, monthIndex, todayISO } from '@journal/core';
import { PRESETS, rangeDays, resolveRange, type Preset } from '@journal/core';
import type { ISODate, Student } from '@journal/core';
import { Button, Card, Field, Input, Notice, PageTitle, Segmented, Select, cx } from '../../components/ui';
import { ColumnChart, HBarChart, Legend, Sparkline, StackChart, TrendChart, type SeriesDef } from './charts';
import { ItemHeatmap } from './ItemHeatmap';
import { VIZ_VARS } from './vizTheme';

export default function DashboardPage() {
  const student = useStudent();
  const extent = useRepo(dataExtent, student.id);
  const [preset, setPreset] = useState<Preset>('all');
  const [custom, setCustom] = useState({ from: student.yearStart, to: todayISO() });
  const [groupingChoice, setGroupingChoice] = useState<Grouping | null>(null);
  const [subject, setSubject] = useState('');

  if (extent === undefined) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  if (extent === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Дашборд" />
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ще немає спостережень. Заповніть кілька уроків на екрані «Сьогодні» — тут з'являться показники й динаміка. Щоб
            подивитися, як це виглядає, відкрийте демо-дані в налаштуваннях.
          </p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-700 underline dark:text-brand-200">
            До уроків
          </Link>
        </Card>
      </div>
    );
  }

  const range = resolveRange(preset, student, extent, custom);
  // Поки даних менше ніж на два місяці, по місяцях порівнювати нема чого — групуємо по тижнях.
  const grouping: Grouping = groupingChoice ?? (rangeDays(range) < 75 ? 'week' : 'month');
  return (
    <div>
      <PageTitle
        title="Дашборд"
        subtitle={`${student.name} · ${fmtDate(range.from, 'd MMM yyyy')} — ${fmtDate(range.to, 'd MMM yyyy')}`}
        actions={
          <Link to={`/export?type=report&from=${range.from}&to=${range.to}`}>
            <Button>
              <FileDown size={16} /> Звіт за період
            </Button>
          </Link>
        }
      />
      {/* Фільтри — один рядок над усіма графіками, діють на весь дашборд. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Період" className="w-56">
          <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {preset === 'custom' && (
          <>
            <Field label="З" className="w-40">
              <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="По" className="w-40">
              <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </>
        )}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Групування</span>
          <Segmented<Grouping>
            label="Групування"
            options={[
              { id: 'month', label: 'Місяці' },
              { id: 'week', label: 'Тижні' },
            ]}
            value={grouping}
            onChange={(v) => v && setGroupingChoice(v)}
          />
        </div>
        <SubjectFilter student={student} range={range} value={subject} onChange={setSubject} />
      </div>
      {range.from > range.to ? (
        <Notice tone="warn">Порожній період: дата початку пізніша за дату завершення.</Notice>
      ) : (
        <DashboardBody student={student} range={range} grouping={grouping} subject={subject} />
      )}
    </div>
  );
}

function SubjectFilter({
  student,
  range,
  value,
  onChange,
}: {
  student: Student;
  range: { from: ISODate; to: ISODate };
  value: string;
  onChange: (v: string) => void;
}) {
  const subjects = useQuery(
    async () => {
      const ds = await loadDataset(student, range.from, range.to);
      return [...new Set(ds.lessons.map((l) => l.subject))].sort((a, b) => a.localeCompare(b, 'uk'));
    },
    loadDataset.tables,
    [student.id, range.from, range.to],
  );
  return (
    <Field label="Предмет" className="w-56">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Усі предмети</option>
        {subjects?.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function filterDataset(ds: Dataset, subject: string): Dataset {
  if (!subject) return ds;
  // Комунікацію оцінюють за день, а не за предмет — у розрізі предмета її немає.
  return { ...ds, lessons: ds.lessons.filter((l) => l.subject === subject), days: [] };
}

function DashboardBody({
  student,
  range,
  grouping,
  subject,
}: {
  student: Student;
  range: { from: ISODate; to: ISODate };
  grouping: Grouping;
  subject: string;
}) {
  const ds = useRepo(loadDataset, student, range.from, range.to);
  const analysis = useMemo(() => (ds ? analyze(filterDataset(ds, subject), grouping) : undefined), [ds, subject, grouping]);
  if (!analysis || !ds) return <div className="p-6 text-sm text-slate-500">Рахую показники…</div>;
  const { overall } = analysis;
  if (overall.observed === 0 && overall.observedDays === 0) {
    return <Notice tone="info">За вибраний період немає заповнених спостережень.</Notice>;
  }
  return (
    <div className="viz space-y-4">
      <Coverage analysis={analysis} />
      <KpiRow analysis={analysis} />
      <InsightsCard insights={analysis.insights} />
      <MainTrend analysis={analysis} />
      <CategoryMultiples analysis={analysis} hasSocial={!subject} />
      <Card title="Кожен пункт бланку: частота, % уроків">
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
          Частка уроків, де пункт позначено, серед уроків із заповненою категорією (для комунікації — серед днів). «+» — позитивний
          пункт, «−» — негативний. У колонці «Зміна»: зелений — покращення, червоний — погіршення
          {analysis.current && analysis.previous && ` (${analysis.current.label} порівняно з ${analysis.previous.label})`}.
        </p>
        <ItemHeatmap
          buckets={analysis.buckets}
          grouping={grouping}
          settings={ds.settings}
          current={analysis.current}
          previous={analysis.previous}
          categories={CATEGORIES.map((c) => c.id).filter((id) => subject === '' || id !== 'social')}
        />
      </Card>
      <HelpDistribution analysis={analysis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BySubject analysis={analysis} />
        <ByLessonNumber analysis={analysis} />
      </div>
    </div>
  );
}

function Coverage({ analysis }: { analysis: Analysis }) {
  const o = analysis.overall;
  const pct = o.attended ? Math.round((100 * o.observed) / o.attended) : 0;
  return (
    <p className="text-sm text-slate-600 dark:text-slate-300">
      Заплановано уроків: <b>{o.scheduled}</b> · відсутність: <b>{o.absent}</b> · заповнено спостережень: <b>{o.observed}</b> з {o.attended}{' '}
      відвіданих ({pct}%) · днів із підсумком: <b>{o.observedDays}</b>
    </p>
  );
}

const bucketShort = (b: Bucket, g: Grouping) => (g === 'month' ? MONTHS_SHORT[monthIndex(b.key)] : b.label);
const compareWith = (b: Bucket, g: Grouping) => (g === 'month' ? MONTHS_INS[monthIndex(b.key)] : `з тижнем ${b.label}`);

function KpiRow({ analysis }: { analysis: Analysis }) {
  const tiles: { metric: MetricId; unit: string; hint: string }[] = [
    { metric: 'learningIndex', unit: '', hint: 'Навчальна діяльність, увага, взаємодія з вчителем, самостійність' },
    { metric: 'behaviorIndex', unit: '', hint: 'Поведінка, емоційний стан, комунікація' },
    { metric: 'independence', unit: '', hint: 'Обернене до рівня допомоги асистента й кількості адаптацій' },
    { metric: 'attendance', unit: '%', hint: 'Відвідані уроки з запланованих' },
  ];
  const { current, previous, overall, buckets, grouping } = analysis;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ metric, unit, hint }) => {
        const value = (current ?? overall).metrics[metric].value;
        const d = delta(value, previous?.metrics[metric].value);
        const trend = weeklyTrend(analysis, metric);
        return (
          <div key={metric} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" title={hint}>
            <div className="text-sm text-slate-600 dark:text-slate-300">{METRIC_LABELS[metric]}</div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div className="text-3xl font-semibold">
                {value == null ? '—' : Math.round(value)}
                {value != null && unit && <span className="text-lg font-normal text-slate-500">{unit}</span>}
              </div>
              <Sparkline values={buckets.filter((b) => b.observed > 0).slice(-12).map((b) => b.metrics[metric].value)} />
            </div>
            <div className="mt-1 min-h-5 text-xs">
              {d != null && previous && Math.round(d) !== 0 ? (
                <span className="inline-flex items-center gap-1 font-medium" style={{ color: d > 0 ? VIZ_VARS.good : VIZ_VARS.bad }}>
                  {d > 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                  {fmtDelta(d)} п.п. порівняно {compareWith(previous, grouping)}
                </span>
              ) : (
                <span className="text-slate-500">{current ? `${current.label}` : 'за весь період'}</span>
              )}
            </div>
            {trend != null && metric !== 'attendance' && (
              <div className="text-xs text-slate-500">
                тренд {trend >= 0 ? '+' : '−'}
                {Math.abs(trend).toFixed(1)} п.п./тиждень
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const INSIGHT_ICON = {
  good: <TrendingUp size={16} aria-label="покращення" style={{ color: VIZ_VARS.good }} />,
  bad: <TrendingDown size={16} aria-label="погіршення" style={{ color: VIZ_VARS.bad }} />,
  neutral: <Info size={16} aria-label="спостереження" className="text-slate-500" />,
  info: <AlertCircle size={16} aria-label="примітка" className="text-sky-600 dark:text-sky-300" />,
};

function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <Card title="Висновки">
      <ul className="space-y-2">
        {insights.map((i, idx) => (
          <li key={idx} className={cx('flex gap-2 text-sm', idx === 0 && 'text-base font-medium')}>
            <span className="mt-0.5 shrink-0">{INSIGHT_ICON[i.tone]}</span>
            <span>{i.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Висновки про зміну з'являються, лише коли в обох періодах достатньо заповнених уроків і зміна перевищує поріг (налаштовується).
      </p>
    </Card>
  );
}

type TrendRow = Record<string, unknown> & { label: string; full: string; n: number };

function trendRows(buckets: Bucket[], g: Grouping, metrics: MetricId[]): TrendRow[] {
  return buckets
    .filter((b) => b.observed > 0 || b.observedDays > 0)
    .map((b) => ({
      label: bucketShort(b, g),
      full: b.label,
      n: b.observed,
      ...Object.fromEntries(metrics.map((m) => [m, b.metrics[m].value])),
    }));
}

function MainTrend({ analysis }: { analysis: Analysis }) {
  const [table, setTable] = useState(false);
  const series: SeriesDef[] = [
    { key: 'learningIndex', name: 'Індекс навчання', color: VIZ_VARS.s1 },
    { key: 'behaviorIndex', name: 'Індекс поведінки', color: VIZ_VARS.s2 },
  ];
  const rows = trendRows(analysis.buckets, analysis.grouping, ['learningIndex', 'behaviorIndex', 'independence', 'attendance']);
  return (
    <Card
      title="Динаміка навчання й поведінки"
      actions={
        <Button size="sm" variant="ghost" onClick={() => setTable((t) => !t)}>
          {table ? 'Графік' : 'Таблиця'}
        </Button>
      }
    >
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-medium">Період</th>
                <th className="py-1 font-medium">Уроків</th>
                <th className="py-1 font-medium">Навчання</th>
                <th className="py-1 font-medium">Поведінка</th>
                <th className="py-1 font-medium">Самостійність</th>
                <th className="py-1 font-medium">Відвідуваність</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.full}>
                  <td className="py-1.5">{row.full}</td>
                  <td>{row.n}</td>
                  {(['learningIndex', 'behaviorIndex', 'independence', 'attendance'] as const).map((m) => (
                    <td key={m}>{row[m] == null ? '—' : `${Math.round(row[m] as number)}${m === 'attendance' ? '%' : ''}`}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mb-2">
            <Legend series={series} />
          </div>
          <TrendChart rows={rows} series={series} />
          <p className="mt-1 text-xs text-slate-500">Шкала 0–100, лінія 50 — нейтрально.</p>
        </>
      )}
    </Card>
  );
}

function CategoryMultiples({ analysis, hasSocial }: { analysis: Analysis; hasSocial: boolean }) {
  const metrics: MetricId[] = ['learning', 'attention', 'teacher', 'independence', 'behavior', 'emotion', ...(hasSocial ? (['social'] as MetricId[]) : []), 'concentration'];
  const rows = trendRows(analysis.buckets, analysis.grouping, metrics);
  const { current, previous } = analysis;
  return (
    <Card title="Показники за категоріями">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const d = delta(current?.metrics[m].value, previous?.metrics[m].value);
          const hasData = rows.some((r) => r[m] != null);
          return (
            <div key={m}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{METRIC_LABELS[m]}</span>
                {d != null && Math.round(d) !== 0 && (
                  <span className="text-xs font-medium" style={{ color: d > 0 ? VIZ_VARS.good : VIZ_VARS.bad }}>
                    {d > 0 ? '▲' : '▼'} {fmtDelta(d)}
                  </span>
                )}
              </div>
              {hasData ? (
                <TrendChart rows={rows} series={[{ key: m, name: METRIC_LABELS[m], color: VIZ_VARS.s1 }]} height={130} unit={m === 'concentration' ? '%' : ''} />
              ) : (
                <p className="py-8 text-center text-xs text-slate-500">
                  {m === 'concentration' ? 'Хвилини уваги не вносилися' : 'Немає даних'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HelpDistribution({ analysis }: { analysis: Analysis }) {
  const series: SeriesDef[] = HELP_LEVELS.map((h, i) => ({ key: h.id, name: h.label, color: VIZ_VARS.ord[i] }));
  const rows = analysis.buckets
    .filter((b) => b.help.n > 0)
    .map((b) => ({
      label: bucketShort(b, analysis.grouping),
      n: b.help.n,
      ...Object.fromEntries(HELP_LEVELS.map((h) => [h.id, (100 * b.help[h.id]) / b.help.n])),
    }));
  if (!rows.length) return null;
  return (
    <Card title="Допомога асистента: розподіл уроків за рівнем">
      <div className="mb-2">
        <Legend series={series} kind="rect" />
      </div>
      <StackChart rows={rows} series={series} />
      <p className="mt-1 text-xs text-slate-500">Що світліший і вищий стовпець у частині «не потрібна / періодично», то самостійніша дитина.</p>
    </Card>
  );
}

function BySubject({ analysis }: { analysis: Analysis }) {
  const [metric, setMetric] = useState<'learningIndex' | 'behaviorIndex'>('learningIndex');
  const rows = analysis.bySubject
    .filter((g) => g.stats.observed > 0 && g.stats.metrics[metric].value != null)
    .map((g) => ({ label: g.key, value: g.stats.metrics[metric].value!, n: g.stats.observed }))
    .sort((a, b) => b.value - a.value);
  return (
    <Card
      title="За предметами"
      actions={
        <Segmented
          label="Показник"
          options={[
            { id: 'learningIndex', label: 'Навчання' },
            { id: 'behaviorIndex', label: 'Поведінка' },
          ]}
          value={metric}
          onChange={(v) => v && setMetric(v as typeof metric)}
        />
      }
    >
      {rows.length ? <HBarChart rows={rows} name={METRIC_LABELS[metric]} /> : <p className="text-sm text-slate-500">Немає даних.</p>}
    </Card>
  );
}

function ByLessonNumber({ analysis }: { analysis: Analysis }) {
  const rows = analysis.byLessonNumber
    .filter((g) => g.stats.observed > 0)
    .map((g) => ({ label: `${g.key} урок`, value: g.stats.itemFreq['beh.tires']?.pct ?? null, n: g.stats.observed }));
  const behavior = analysis.byLessonNumber
    .filter((g) => g.stats.observed > 0)
    .map((g) => ({ label: `${g.key} урок`, value: g.stats.metrics.behaviorIndex.value, n: g.stats.observed }));
  const [mode, setMode] = useState<'tires' | 'behavior'>('tires');
  return (
    <Card
      title="Протягом дня"
      actions={
        <Segmented
          label="Показник"
          options={[
            { id: 'tires', label: 'Втома, %' },
            { id: 'behavior', label: 'Поведінка' },
          ]}
          value={mode}
          onChange={(v) => v && setMode(v as typeof mode)}
        />
      }
    >
      {mode === 'tires' ? (
        <>
          <ColumnChart rows={rows} name="«Швидко втомлюється», % уроків" unit="%" />
          <p className="mt-1 text-xs text-slate-500">За номером уроку: частка уроків із позначкою «Швидко втомлюється».</p>
        </>
      ) : (
        <>
          <ColumnChart rows={behavior} name="Індекс поведінки" />
          <p className="mt-1 text-xs text-slate-500">За номером уроку: середній індекс поведінки.</p>
        </>
      )}
    </Card>
  );
}
