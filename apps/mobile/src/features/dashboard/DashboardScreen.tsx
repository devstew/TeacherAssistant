import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, Info, TrendingDown, TrendingUp } from 'lucide-react-native';
import {
  CATEGORIES,
  HELP_LEVELS,
  METRIC_LABELS,
  MONTHS_INS,
  MONTHS_SHORT,
  PRESETS,
  analyze,
  dataExtent,
  delta,
  fmtDate,
  fmtDelta,
  loadDataset,
  monthIndex,
  rangeDays,
  resolveRange,
  todayISO,
  useQuery,
  useRepo,
  weeklyTrend,
  type Analysis,
  type Bucket,
  type ChartRow,
  type Dataset,
  type DateRange,
  type Grouping,
  type Insight,
  type MetricId,
  type Preset,
  type Student,
} from '@journal/core';
import { Button, Card, Field, Notice, PageTitle, Segmented, Select } from '@/components/ui';
import { DateField } from '@/components/fields';
import { Screen } from '@/components/Screen';
import {
  ColumnChart,
  HBarChart,
  Legend,
  Sparkline,
  StackChart,
  TrendChart,
  useViz,
  type SeriesDef,
} from '@/components/charts';
import { ItemFrequency } from './ItemFrequency';
import { useStudents } from '@/state/student';
import { font, radius, sp, useTheme } from '@/theme';

export function DashboardScreen() {
  const t = useTheme();
  const { student } = useStudents();
  const extent = useRepo(dataExtent, student?.id ?? '');
  const [preset, setPreset] = useState<Preset>('all');
  const [custom, setCustom] = useState<DateRange>({ from: student?.yearStart ?? todayISO(), to: todayISO() });
  const [groupingChoice, setGroupingChoice] = useState<Grouping | null>(null);
  const [subject, setSubject] = useState('');

  if (!student || extent === undefined) return null;

  if (extent === null)
    return (
      <Screen>
        <PageTitle title="Дашборд" />
        <Card>
          <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
            Ще немає спостережень. Заповніть кілька уроків на екрані «Сьогодні» — тут з’являться показники й динаміка.
          </Text>
          <Button onPress={() => router.push('/')}>До уроків</Button>
        </Card>
      </Screen>
    );

  const range = resolveRange(preset, student, extent, custom);
  // Поки даних менше ніж на два місяці, по місяцях порівнювати нема чого — групуємо по тижнях.
  const grouping: Grouping = groupingChoice ?? (rangeDays(range) < 75 ? 'week' : 'month');
  const years = [Number(student.yearStart.slice(0, 4)), Number(student.yearEnd.slice(0, 4))].filter(
    (y, i, a) => a.indexOf(y) === i,
  );

  return (
    <Screen>
      <PageTitle
        title="Дашборд"
        subtitle={`${fmtDate(range.from, 'd MMM yyyy')} — ${fmtDate(range.to, 'd MMM yyyy')}`}
      />

      <Card title="Період">
        <View style={{ gap: sp.md }}>
          <Select label="Період" value={preset} options={PRESETS} onChange={(v) => setPreset(v)} />
          {preset === 'custom' && (
            <>
              <Field label="З">
                <DateField label="Початок" value={custom.from} years={years} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
              </Field>
              <Field label="По">
                <DateField label="Кінець" value={custom.to} years={years} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
              </Field>
            </>
          )}
          <Field label="Групування">
            <Segmented<Grouping>
              label="Групування"
              options={[
                { id: 'month', label: 'Місяці' },
                { id: 'week', label: 'Тижні' },
              ]}
              value={grouping}
              onChange={(v) => v && setGroupingChoice(v)}
            />
          </Field>
          <SubjectFilter student={student} range={range} value={subject} onChange={setSubject} />
        </View>
      </Card>

      {range.from > range.to ? (
        <Notice tone="warn">Порожній період: дата початку пізніша за дату завершення.</Notice>
      ) : (
        <DashboardBody student={student} range={range} grouping={grouping} subject={subject} />
      )}
    </Screen>
  );
}

function SubjectFilter({
  student,
  range,
  value,
  onChange,
}: {
  student: Student;
  range: DateRange;
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
    <Field label="Предмет">
      <Select
        label="Предмет"
        value={value}
        options={[{ id: '', label: 'Усі предмети' }, ...(subjects ?? []).map((s) => ({ id: s, label: s }))]}
        onChange={onChange}
      />
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
  range: DateRange;
  grouping: Grouping;
  subject: string;
}) {
  const t = useTheme();
  const ds = useRepo(loadDataset, student, range.from, range.to);
  const analysis = useMemo(() => (ds ? analyze(filterDataset(ds, subject), grouping) : undefined), [ds, subject, grouping]);

  if (!analysis || !ds) return <Text style={{ color: t.muted, fontSize: font.sm }}>Рахую показники…</Text>;
  const { overall } = analysis;
  if (overall.observed === 0 && overall.observedDays === 0)
    return <Notice tone="info">За вибраний період немає заповнених спостережень.</Notice>;

  return (
    <View style={{ gap: sp.lg }}>
      <Coverage analysis={analysis} />
      <KpiGrid analysis={analysis} />
      <InsightsCard insights={analysis.insights} />
      <MainTrend analysis={analysis} />
      <CategoryMultiples analysis={analysis} hasSocial={!subject} />
      <Card title="Кожен пункт бланку: частота, % уроків">
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20, marginBottom: sp.md }}>
          Частка уроків, де пункт позначено, серед уроків із заповненою категорією (для комунікації — серед днів). «+» —
          позитивний пункт, «−» — негативний
          {analysis.current && analysis.previous ? `; зміна — ${analysis.current.label} проти ${analysis.previous.label}` : ''}.
        </Text>
        <ItemFrequency
          buckets={analysis.buckets}
          settings={ds.settings}
          current={analysis.current}
          previous={analysis.previous}
          categories={CATEGORIES.map((c) => c.id).filter((id) => subject === '' || id !== 'social')}
        />
      </Card>
      <HelpDistribution analysis={analysis} />
      <BySubject analysis={analysis} />
      <ByLessonNumber analysis={analysis} />
    </View>
  );
}

function Coverage({ analysis }: { analysis: Analysis }) {
  const t = useTheme();
  const o = analysis.overall;
  const pct = o.attended ? Math.round((100 * o.observed) / o.attended) : 0;
  return (
    <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
      Заплановано уроків: {o.scheduled} · відсутність: {o.absent} · заповнено спостережень: {o.observed} з {o.attended} (
      {pct}%) · днів із підсумком: {o.observedDays}
    </Text>
  );
}

const bucketShort = (b: Bucket, g: Grouping) => (g === 'month' ? MONTHS_SHORT[monthIndex(b.key)] : b.label);
const compareWith = (b: Bucket, g: Grouping) => (g === 'month' ? MONTHS_INS[monthIndex(b.key)] : `з тижнем ${b.label}`);

function KpiGrid({ analysis }: { analysis: Analysis }) {
  const t = useTheme();
  const c = useViz();
  const tiles: { metric: MetricId; unit: string }[] = [
    { metric: 'learningIndex', unit: '' },
    { metric: 'behaviorIndex', unit: '' },
    { metric: 'independence', unit: '' },
    { metric: 'attendance', unit: '%' },
  ];
  const { current, previous, overall, buckets, grouping } = analysis;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.md }}>
      {tiles.map(({ metric, unit }) => {
        const value = (current ?? overall).metrics[metric].value;
        const d = delta(value, previous?.metrics[metric].value);
        const trend = weeklyTrend(analysis, metric);
        const changed = d != null && previous && Math.round(d) !== 0;
        return (
          <View
            key={metric}
            style={{
              flexGrow: 1,
              flexBasis: '46%',
              backgroundColor: t.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.line,
              padding: sp.md,
            }}
          >
            <Text style={{ color: t.subtle, fontSize: font.xs }} numberOfLines={1}>
              {METRIC_LABELS[metric]}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: sp.sm }}>
              <Text style={{ color: t.text, fontSize: 28, fontWeight: '700' }}>
                {value == null ? '—' : Math.round(value)}
                {value != null && unit ? <Text style={{ fontSize: font.md, color: t.muted }}>{unit}</Text> : null}
              </Text>
              <Sparkline
                values={buckets
                  .filter((b) => b.observed > 0)
                  .slice(-12)
                  .map((b) => b.metrics[metric].value)}
                width={56}
                height={20}
              />
            </View>
            <Text style={{ fontSize: font.xs, color: changed ? (d! > 0 ? c.good : c.bad) : t.muted }} numberOfLines={2}>
              {changed
                ? `${d! > 0 ? '▲' : '▼'} ${fmtDelta(d!)} п.п. порівняно ${compareWith(previous!, grouping)}`
                : current
                  ? current.label
                  : 'за весь період'}
            </Text>
            {trend != null && metric !== 'attendance' && (
              <Text style={{ color: t.muted, fontSize: font.xs }}>
                тренд {trend >= 0 ? '+' : '−'}
                {Math.abs(trend).toFixed(1)} п.п./тиждень
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function InsightsCard({ insights }: { insights: Insight[] }) {
  const t = useTheme();
  const c = useViz();
  const icon = (tone: Insight['tone']) =>
    tone === 'good' ? (
      <TrendingUp color={c.good} size={16} />
    ) : tone === 'bad' ? (
      <TrendingDown color={c.bad} size={16} />
    ) : tone === 'info' ? (
      <AlertCircle color={t.brandInk} size={16} />
    ) : (
      <Info color={t.muted} size={16} />
    );

  return (
    <Card title="Висновки">
      <View style={{ gap: sp.sm }}>
        {insights.map((i, idx) => (
          <View key={idx} style={{ flexDirection: 'row', gap: sp.sm }}>
            <View style={{ paddingTop: 2 }}>{icon(i.tone)}</View>
            <Text
              style={{
                color: t.text,
                fontSize: idx === 0 ? font.md : font.sm,
                fontWeight: idx === 0 ? '600' : '400',
                lineHeight: idx === 0 ? 22 : 20,
                flex: 1,
              }}
            >
              {i.text}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: font.xs, marginTop: sp.md }}>
        Висновки про зміну з’являються, лише коли в обох періодах достатньо заповнених уроків і зміна перевищує поріг.
      </Text>
    </Card>
  );
}

function trendRows(buckets: Bucket[], g: Grouping, metrics: MetricId[]): ChartRow[] {
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
  const t = useTheme();
  const c = useViz();
  const [table, setTable] = useState(false);
  const metrics: MetricId[] = ['learningIndex', 'behaviorIndex', 'independence', 'attendance'];
  const series: SeriesDef[] = [
    { key: 'learningIndex', name: 'Індекс навчання', color: c.s1 },
    { key: 'behaviorIndex', name: 'Індекс поведінки', color: c.s2 },
  ];
  const rows = trendRows(analysis.buckets, analysis.grouping, metrics);

  return (
    <Card
      title="Динаміка навчання й поведінки"
      actions={
        <Button size="sm" variant="ghost" onPress={() => setTable((v) => !v)}>
          {table ? 'Графік' : 'Таблиця'}
        </Button>
      }
    >
      {table ? (
        <View style={{ gap: sp.sm }}>
          {rows.map((row) => (
            <View key={String(row.full)} style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
              <Text style={{ color: t.text, fontSize: font.sm, flex: 1 }} numberOfLines={1}>
                {String(row.full)}
              </Text>
              <Text style={{ color: t.muted, fontSize: font.xs, width: 34 }}>{String(row.n)} ур.</Text>
              {metrics.map((m) => (
                <Text key={m} style={{ color: t.subtle, fontSize: font.sm, width: 34, textAlign: 'right' }}>
                  {row[m] == null ? '—' : Math.round(row[m] as number)}
                </Text>
              ))}
            </View>
          ))}
          <Text style={{ color: t.muted, fontSize: font.xs }}>
            Колонки: навчання · поведінка · самостійність · відвідуваність.
          </Text>
        </View>
      ) : (
        <View style={{ gap: sp.sm }}>
          <Legend series={series} />
          <TrendChart rows={rows} series={series} />
          <Text style={{ color: t.muted, fontSize: font.xs }}>Шкала 0–100, пунктир 50 — нейтрально.</Text>
        </View>
      )}
    </Card>
  );
}

function CategoryMultiples({ analysis, hasSocial }: { analysis: Analysis; hasSocial: boolean }) {
  const t = useTheme();
  const c = useViz();
  const metrics: MetricId[] = [
    'learning',
    'attention',
    'teacher',
    'independence',
    'behavior',
    'emotion',
    ...(hasSocial ? (['social'] as MetricId[]) : []),
    'concentration',
  ];
  const rows = trendRows(analysis.buckets, analysis.grouping, metrics);
  const { current, previous } = analysis;

  return (
    <Card title="Показники за категоріями">
      <View style={{ gap: sp.lg }}>
        {metrics.map((m) => {
          const d = delta(current?.metrics[m].value, previous?.metrics[m].value);
          const hasData = rows.some((r) => r[m] != null);
          return (
            <View key={m} style={{ gap: sp.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: sp.sm }}>
                <Text style={{ color: t.text, fontSize: font.sm, fontWeight: '600' }}>{METRIC_LABELS[m]}</Text>
                {d != null && Math.round(d) !== 0 && (
                  <Text style={{ color: d > 0 ? c.good : c.bad, fontSize: font.xs, fontWeight: '600' }}>
                    {d > 0 ? '▲' : '▼'} {fmtDelta(d)}
                  </Text>
                )}
              </View>
              {hasData ? (
                <TrendChart
                  rows={rows}
                  series={[{ key: m, name: METRIC_LABELS[m], color: c.s1 }]}
                  height={120}
                  unit={m === 'concentration' ? '%' : ''}
                />
              ) : (
                <Text style={{ color: t.muted, fontSize: font.xs, paddingVertical: sp.md }}>
                  {m === 'concentration' ? 'Хвилини уваги не вносилися' : 'Немає даних'}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function HelpDistribution({ analysis }: { analysis: Analysis }) {
  const t = useTheme();
  const c = useViz();
  const series: SeriesDef[] = HELP_LEVELS.map((h, i) => ({ key: h.id, name: h.label, color: c.ord[i] }));
  const rows: ChartRow[] = analysis.buckets
    .filter((b) => b.help.n > 0)
    .map((b) => ({
      label: bucketShort(b, analysis.grouping),
      ...Object.fromEntries(HELP_LEVELS.map((h) => [h.id, (100 * b.help[h.id]) / b.help.n])),
    }));
  if (!rows.length) return null;

  return (
    <Card title="Допомога асистента: розподіл уроків">
      <View style={{ gap: sp.sm }}>
        <Legend series={series} kind="rect" />
        <StackChart rows={rows} series={series} />
        <Text style={{ color: t.muted, fontSize: font.xs }}>
          Що більша частка «не потрібна / періодично», то самостійніша дитина.
        </Text>
      </View>
    </Card>
  );
}

function BySubject({ analysis }: { analysis: Analysis }) {
  const t = useTheme();
  const [metric, setMetric] = useState<'learningIndex' | 'behaviorIndex'>('learningIndex');
  const rows = analysis.bySubject
    .filter((g) => g.stats.observed > 0 && g.stats.metrics[metric].value != null)
    .map((g) => ({ label: g.key, value: g.stats.metrics[metric].value! }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card title="За предметами">
      <View style={{ gap: sp.md }}>
        <Segmented
          label="Показник"
          options={[
            { id: 'learningIndex', label: 'Навчання' },
            { id: 'behaviorIndex', label: 'Поведінка' },
          ]}
          value={metric}
          onChange={(v) => v && setMetric(v as typeof metric)}
        />
        {rows.length ? (
          <HBarChart rows={rows} />
        ) : (
          <Text style={{ color: t.muted, fontSize: font.sm }}>Немає даних.</Text>
        )}
      </View>
    </Card>
  );
}

function ByLessonNumber({ analysis }: { analysis: Analysis }) {
  const t = useTheme();
  const [mode, setMode] = useState<'tires' | 'behavior'>('tires');
  const groups = analysis.byLessonNumber.filter((g) => g.stats.observed > 0);
  const rows = groups.map((g) => ({
    label: String(g.key),
    value: mode === 'tires' ? (g.stats.itemFreq['beh.tires']?.pct ?? null) : g.stats.metrics.behaviorIndex.value,
  }));

  return (
    <Card title="Протягом дня">
      <View style={{ gap: sp.md }}>
        <Segmented
          label="Показник"
          options={[
            { id: 'tires', label: 'Втома, %' },
            { id: 'behavior', label: 'Поведінка' },
          ]}
          value={mode}
          onChange={(v) => v && setMode(v as typeof mode)}
        />
        {rows.length ? (
          <>
            <ColumnChart rows={rows} unit={mode === 'tires' ? '%' : ''} />
            <Text style={{ color: t.muted, fontSize: font.xs }}>
              {mode === 'tires'
                ? 'За номером уроку: частка уроків із позначкою «Швидко втомлюється».'
                : 'За номером уроку: середній індекс поведінки.'}
            </Text>
          </>
        ) : (
          <Text style={{ color: t.muted, fontSize: font.sm }}>Немає даних.</Text>
        )}
      </View>
    </Card>
  );
}
