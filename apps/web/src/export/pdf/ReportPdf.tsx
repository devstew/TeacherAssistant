/** Аналітичний звіт за період у PDF: висновки, показники по місяцях, графіки, частоти пунктів, примітки. */
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Student } from '@journal/core';
import type { ChartImage } from '../chartImage';
import { METHOD_NOTE, type ReportModel } from '@journal/core';
import { studentLine } from '@journal/core';
import { Footer, INK, MUTED, Table, k } from './kit';

const s = StyleSheet.create({
  page: { ...k.page, fontSize: 8.5, paddingHorizontal: 32, paddingTop: 30, paddingBottom: 36 },
  h1: { fontSize: 15, fontWeight: 'bold' },
  h2: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 5 },
  h3: { fontSize: 9, fontWeight: 'bold', marginTop: 6, marginBottom: 3 },
  sub: { color: MUTED, marginTop: 2 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  dot: { width: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  small: { fontSize: 7.5, color: MUTED },
});

function ChartBlock({ chart, title }: { chart: ChartImage; title: string }) {
  const w = 520;
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <Text style={s.h3}>{title}</Text>
      <View style={s.legend}>
        {chart.legend.map((l) => (
          <View key={l.key} style={s.legendItem}>
            <View
              style={
                chart.legendKind === 'line'
                  ? { width: 12, height: 2, backgroundColor: l.color, marginRight: 4 }
                  : { width: 7, height: 7, backgroundColor: l.color, marginRight: 4 }
              }
            />
            <Text style={{ color: INK, fontSize: 7.5 }}>{l.name}</Text>
          </View>
        ))}
      </View>
      <Image src={chart.dataUrl} style={{ width: w, height: (w * chart.height) / chart.width }} />
    </View>
  );
}

export function ReportDocument({
  student,
  period,
  report,
  charts,
  generatedAt,
}: {
  student: Student;
  period: string;
  report: ReportModel;
  charts: ChartImage[];
  generatedAt: string;
}) {
  const { analysis } = report;
  const chartTitles = ['Динаміка індексів навчання й поведінки (0–100, 50 — нейтрально)', 'Допомога асистента: розподіл уроків за рівнем, %'];
  return (
    <Document title={`Аналітичний звіт — ${student.name}`} author={student.assistantName || 'Асистент вчителя'} language="uk">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Аналітичний звіт спостережень асистента вчителя</Text>
        <Text style={s.sub}>{studentLine(student)}</Text>
        <Text style={s.sub}>
          Період: {period} · сформовано {generatedAt}
        </Text>
        <Text style={s.sub}>
          Заплановано уроків: {analysis.overall.scheduled}, відсутність: {analysis.overall.absent}, заповнено спостережень: {analysis.overall.observed}{' '}
          з {analysis.overall.attended} відвіданих, днів із підсумком: {analysis.overall.observedDays}.
        </Text>

        <Text style={s.h2}>Висновки</Text>
        {analysis.insights.map((i, idx) => (
          <View key={idx} style={s.bullet}>
            <Text style={s.dot}>•</Text>
            <Text style={{ flex: 1, fontWeight: idx === 0 ? 'bold' : 'normal' }}>{i.text}</Text>
          </View>
        ))}

        <Text style={s.h2}>Показники по місяцях</Text>
        <Table head={report.metricsTable.head} rows={report.metricsTable.rows} firstWidth={28} fontSize={7.8} />

        {charts.map((c, i) => (
          <ChartBlock key={i} chart={c} title={chartTitles[i] ?? ''} />
        ))}
        <Footer left={`Аналітичний звіт · ${student.name}`} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Частота пунктів бланку по місяцях</Text>
        <Text style={s.small}>(+) позитивний пункт, (−) негативний. Для негативних пунктів зменшення частоти — покращення.</Text>
        {report.itemTables.map((it) => (
          <View key={it.title}>
            <Text style={s.h3}>
              {it.title}, {it.unit}
            </Text>
            <Table head={it.table.head} rows={it.table.rows} firstWidth={46} fontSize={7.2} />
          </View>
        ))}
        <Footer left={`Аналітичний звіт · ${student.name}`} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Примітки асистента</Text>
        {report.notes.length ? (
          report.notes.map((n, i) => (
            <View key={i} style={s.bullet} wrap={false}>
              <Text style={{ width: 70, color: MUTED }}>{n.date}</Text>
              <Text style={{ flex: 1 }}>{n.text}</Text>
            </View>
          ))
        ) : (
          <Text style={s.small}>Приміток за період немає.</Text>
        )}
        {report.comments.length > 0 && (
          <>
            <Text style={s.h2}>Коментарі до уроків</Text>
            {report.comments.map((c, i) => (
              <View key={i} style={s.bullet} wrap={false}>
                <Text style={{ width: 70, color: MUTED }}>{c.date}</Text>
                <Text style={{ width: 110 }}>{c.lesson}</Text>
                <Text style={{ flex: 1 }}>{c.text}</Text>
              </View>
            ))}
          </>
        )}
        <Text style={[s.small, { marginTop: 14 }]}>{METHOD_NOTE}</Text>
        <Footer left={`Аналітичний звіт · ${student.name}`} />
      </Page>
    </Document>
  );
}
