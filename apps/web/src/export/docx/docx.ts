/**
 * DOCX-версії документів (редаговані у Word/LibreOffice/Google Docs):
 * щоденні аркуші за бланком і аналітичний звіт.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from 'docx';
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
import { dataUrlToBytes, type ChartImage } from '../chartImage';
import { METHOD_NOTE, type ReportModel } from '@journal/core';
import { LESSONS_PER_SHEET, chunk, dayTitle, studentLine, type SheetDay, type SheetLesson } from '@journal/core';

const GREEN = 'DCEBD0';
const BEIGE = 'F3E0D3';
const SYMBOL_FONT = 'Segoe UI Symbol';
const SIZE = 15; // 7.5 pt (у пів-пунктах)

const border: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: '4B4B48' };
const borders = { top: border, bottom: border, left: border, right: border };

const PAGE = {
  size: { width: 11906, height: 16838 },
  margin: { top: 567, bottom: 567, left: 567, right: 567, footer: 283 },
};
/** Ширина тексту на сторінці, twips. */
const CONTENT_WIDTH = PAGE.size.width - PAGE.margin.left - PAGE.margin.right;
const dxa = (pct: number) => Math.round((CONTENT_WIDTH * pct) / 100);

/**
 * Таблиця з явною сіткою колонок (twips) і фіксованою розкладкою: лише відсоткові
 * ширини Word ще розуміє, а LibreOffice, Google Docs і Quick Look — ні.
 */
function grid(rows: TableRow[], widthsPct: number[]) {
  return new Table({
    rows,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widthsPct.map(dxa),
    layout: TableLayoutType.FIXED,
  });
}

function text(t: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text: t, size: opts.size ?? SIZE, bold: opts.bold, color: opts.color, italics: opts.italics });
}

function box(on: boolean) {
  return new TextRun({ text: on ? '☒ ' : '☐ ', font: SYMBOL_FONT, size: SIZE });
}

function itemPara(on: boolean, label: string) {
  return new Paragraph({ spacing: { after: 20 }, children: [box(on), text(label)] });
}

function items(cat: CategoryDef, checks: Set<string>) {
  return cat.items.map((i) => itemPara(checks.has(i.id), i.label));
}

function cell(children: Paragraph[], opts: { width: number; shade?: string; rowSpan?: number; columnSpan?: number } = { width: 25 }) {
  return new TableCell({
    children: children.length ? children : [new Paragraph('')],
    width: { size: dxa(opts.width), type: WidthType.DXA },
    borders,
    rowSpan: opts.rowSpan,
    columnSpan: opts.columnSpan,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    shading: opts.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.shade } : undefined,
  });
}

const th = (t: string) => new Paragraph({ alignment: AlignmentType.CENTER, children: [text(t, { bold: true, size: 16 })] });
const absent = () => [new Paragraph({ children: [text('Відсутній на уроці (н)', { color: '6B6B66', italics: true })] })];

function sheetHeader(student: Student, day: SheetDay, part: string) {
  return [
    new Paragraph({ children: [text('Журнал спостережень асистента вчителя', { bold: true, size: 24 })] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [text(`${studentLine(student)} · ${dayTitle(day.date)}${part ? ` · ${part}` : ''}`, { size: 16, color: '52514E' })],
    }),
  ];
}

function lessonInfo(l: SheetLesson) {
  const out = [new Paragraph({ children: [text(`Урок ${l.lesson.lessonNumber}`, { bold: true, size: 17 })] })];
  if (l.time) out.push(new Paragraph({ children: [text(`${l.time.start}–${l.time.end}`, { color: '6B6B66' })] }));
  out.push(new Paragraph({ spacing: { before: 40 }, children: [text(l.lesson.subject, { bold: true })] }));
  if (l.lesson.topic) out.push(new Paragraph({ spacing: { before: 40 }, children: [text(`Тема: ${l.lesson.topic}`)] }));
  if (l.lesson.absent) out.push(new Paragraph({ spacing: { before: 60 }, children: [text(`${l.lesson.absenceMarker ?? 'н'} — відсутній`, { bold: true })] }));
  return out;
}

function frontTable(lessons: SheetLesson[]) {
  const W = [19, 41, 20, 20];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([th('Урок / тема')], { width: W[0], shade: BEIGE }),
        cell([th('Навчальна діяльність')], { width: W[1], shade: GREEN }),
        cell([th('Увага / Емоційний стан')], { width: W[2], shade: GREEN }),
        cell([th('Поведінка')], { width: W[3], shade: GREEN }),
      ],
    }),
    ...lessons.map((l) => {
      const checks = new Set(l.obs?.checks ?? []);
      const a = !!l.lesson.absent;
      const attention = [
        ...items(ATTENTION, checks),
        ...(l.obs?.attentionMinutes != null ? [new Paragraph({ children: [text(`Утримує увагу: ${l.obs.attentionMinutes} хв`)] })] : []),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '9A9A95', space: 1 } }, children: [] }),
        ...items(EMOTION, checks),
      ];
      return new TableRow({
        cantSplit: true,
        children: [
          cell(lessonInfo(l), { width: W[0] }),
          cell(a ? absent() : items(LEARNING, checks), { width: W[1] }),
          cell(a ? absent() : attention, { width: W[2] }),
          cell(a ? absent() : items(BEHAVIOR, checks), { width: W[3] }),
        ],
      });
    }),
  ];
  return grid(rows, W);
}

function assistantParas(l: SheetLesson) {
  const checks = new Set(l.obs?.checks ?? []);
  const [org, ...adaptations] = ASSISTANT.items;
  return [
    new Paragraph({ children: [text('Допомога асистента була потрібна:', { bold: true })] }),
    new Paragraph({
      spacing: { after: 40 },
      children: PAPER_HELP_ORDER.flatMap((h) => [box(l.obs?.helpLevel === h), text(`${HELP_LABEL[h]}   `)]),
    }),
    itemPara(checks.has(org.id), org.label),
    new Paragraph({ spacing: { before: 40 }, children: [text('Адаптація:', { bold: true })] }),
    ...adaptations.map((i) => itemPara(checks.has(i.id), i.label)),
    ...(l.obs?.comment ? [new Paragraph({ spacing: { before: 40 }, children: [text(`Коментар: ${l.obs.comment}`)] })] : []),
  ];
}

function socialParas(day: SheetDay, withSocial: boolean) {
  if (!withSocial) return [new Paragraph({ children: [text('Див. перший аркуш цього дня.', { color: '6B6B66' })] })];
  const checks = new Set(day.day?.checks ?? []);
  const out: Paragraph[] = [];
  let prev: string | undefined;
  for (const i of SOCIAL.items) {
    if (i.section && i.section !== prev) out.push(new Paragraph({ children: [text(`${i.section}:`, { bold: true })] }));
    prev = i.section;
    out.push(itemPara(checks.has(i.id), i.label));
  }
  out.push(
    new Paragraph({
      spacing: { before: 160 },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: GREEN },
      alignment: AlignmentType.CENTER,
      children: [text('Примітка', { bold: true, size: 16 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [text('(досягнення, труднощі, навички самообслуговування, рекомендації)', { size: 12 })],
    }),
    ...(day.day?.note ? day.day.note.split('\n') : ['', '', '', '', '']).map((line) => new Paragraph({ spacing: { before: 60 }, children: [text(line)] })),
  );
  return out;
}

function backTable(day: SheetDay, lessons: SheetLesson[], withSocial: boolean) {
  const W = [32, 38, 30];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([th('Взаємодія з вчителем')], { width: W[0], shade: GREEN }),
        cell([th('Взаємодія з асистентом вчителя')], { width: W[1], shade: GREEN }),
        cell([th('Комунікативні та соціальні навички')], { width: W[2], shade: BEIGE }),
      ],
    }),
    ...lessons.map((l, i) => {
      const checks = new Set(l.obs?.checks ?? []);
      const caption = new Paragraph({ children: [text(`Урок ${l.lesson.lessonNumber} · ${l.lesson.subject}`, { size: 13, color: '6B6B66' })] });
      const cells = [
        cell([caption, ...(l.lesson.absent ? absent() : items(TEACHER, checks))], { width: W[0] }),
        cell(l.lesson.absent ? absent() : assistantParas(l), { width: W[1] }),
      ];
      if (i === 0) cells.push(cell(socialParas(day, withSocial), { width: W[2], rowSpan: Math.max(1, lessons.length) }));
      return new TableRow({ children: cells });
    }),
  ];
  if (!lessons.length) rows.push(new TableRow({ children: [cell([], { width: W[0] }), cell([], { width: W[1] }), cell(socialParas(day, withSocial), { width: W[2] })] }));
  return grid(rows, W);
}

function pageFooter(left: string) {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          text(`${left} · стор. `, { size: 13, color: '6B6B66' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 13, color: '6B6B66' }),
          text(' з ', { size: 13, color: '6B6B66' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 13, color: '6B6B66' }),
        ],
      }),
    ],
  });
}

const baseStyles = { default: { document: { run: { font: 'Arial', size: SIZE } } } };

export async function journalDocx(student: Student, days: SheetDay[], title: string): Promise<Blob> {
  const sections = days.flatMap((day) => {
    const sheets = chunk(day.lessons, LESSONS_PER_SHEET);
    return sheets.flatMap((lessons, i) => {
      const part = sheets.length > 1 ? `аркуш ${i + 1} з ${sheets.length}` : '';
      const footers = { default: pageFooter(`${student.name} · ${dayTitle(day.date)}`) };
      return [
        { properties: { page: PAGE }, footers, children: [...sheetHeader(student, day, part), frontTable(lessons)] },
        {
          properties: { page: PAGE },
          footers,
          children: [...sheetHeader(student, day, part ? `${part} · зворот` : 'зворот'), backTable(day, lessons, i === 0)],
        },
      ];
    });
  });
  const doc = new Document({ title, creator: student.assistantName || 'Асистент вчителя', styles: baseStyles, sections });
  return Packer.toBlob(doc);
}

function simpleTable(head: string[], rows: string[][], firstWidth: number) {
  const rest = head.length > 1 ? (100 - firstWidth) / (head.length - 1) : 0;
  const w = (i: number) => (i === 0 ? firstWidth : rest);
  const para = (t: string, i: number, bold = false) =>
    new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, children: [text(t, { bold, size: 15 })] });
  return grid(
    [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell([para(h, i, true)], { width: w(i), shade: GREEN })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell([para(c, i)], { width: w(i) })) })),
    ],
    head.map((_, i) => w(i)),
  );
}

const h1 = (t: string) => new Paragraph({ spacing: { after: 80 }, children: [text(t, { bold: true, size: 30 })] });
const h2 = (t: string) => new Paragraph({ spacing: { before: 240, after: 100 }, children: [text(t, { bold: true, size: 22 })] });
const h3 = (t: string) => new Paragraph({ spacing: { before: 160, after: 60 }, children: [text(t, { bold: true, size: 18 })] });
const p = (t: string, opts: { color?: string; bold?: boolean; size?: number } = {}) =>
  new Paragraph({ spacing: { after: 60 }, children: [text(t, { size: opts.size ?? 17, color: opts.color, bold: opts.bold })] });

export async function reportDocx(
  student: Student,
  period: string,
  report: ReportModel,
  charts: ChartImage[],
  generatedAt: string,
): Promise<Blob> {
  const { analysis } = report;
  const chartTitles = ['Динаміка індексів навчання й поведінки (0–100, 50 — нейтрально)', 'Допомога асистента: розподіл уроків за рівнем, %'];
  const children = [
    h1('Аналітичний звіт спостережень асистента вчителя'),
    p(studentLine(student), { color: '52514E' }),
    p(`Період: ${period} · сформовано ${generatedAt}`, { color: '52514E' }),
    p(
      `Заплановано уроків: ${analysis.overall.scheduled}, відсутність: ${analysis.overall.absent}, заповнено спостережень: ${analysis.overall.observed} з ${analysis.overall.attended} відвіданих, днів із підсумком: ${analysis.overall.observedDays}.`,
      { color: '52514E' },
    ),
    h2('Висновки'),
    ...analysis.insights.map((i, idx) => p(`• ${i.text}`, { bold: idx === 0 })),
    h2('Показники по місяцях'),
    simpleTable(report.metricsTable.head, report.metricsTable.rows, 28),
    ...charts.flatMap((c, i) => [
      h3(chartTitles[i] ?? ''),
      new Paragraph({
        children: c.legend.flatMap((l) => [
          new TextRun({ text: c.legendKind === 'line' ? '━━ ' : '■ ', color: l.color.replace('#', ''), size: 18 }),
          text(`${l.name}    `, { size: 16 }),
        ]),
      }),
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: dataUrlToBytes(c.dataUrl),
            transformation: { width: 620, height: Math.round((620 * c.height) / c.width) },
          }),
        ],
      }),
    ]),
    h2('Частота пунктів бланку по місяцях'),
    p('(+) позитивний пункт, (−) негативний. Для негативних пунктів зменшення частоти — покращення.', { color: '6B6B66', size: 15 }),
    ...report.itemTables.flatMap((it) => [h3(`${it.title}, ${it.unit}`), simpleTable(it.table.head, it.table.rows, 46)]),
    h2('Примітки асистента'),
    ...(report.notes.length ? report.notes.map((n) => p(`${n.date} — ${n.text}`)) : [p('Приміток за період немає.', { color: '6B6B66' })]),
    ...(report.comments.length ? [h2('Коментарі до уроків'), ...report.comments.map((c) => p(`${c.date}, ${c.lesson} — ${c.text}`))] : []),
    new Paragraph({ spacing: { before: 280 }, children: [text(METHOD_NOTE, { size: 14, color: '6B6B66' })] }),
  ];
  const doc = new Document({
    title: `Аналітичний звіт — ${student.name}`,
    creator: student.assistantName || 'Асистент вчителя',
    styles: baseStyles,
    sections: [{ properties: { page: PAGE }, footers: { default: pageFooter(`Аналітичний звіт · ${student.name}`) }, children }],
  });
  return Packer.toBlob(doc);
}
