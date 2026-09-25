import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { seedDemo } from '../dev/seed';
import { loadDataset, type Dataset } from '../db/repo';
import { buildSheetDays } from './sheetData';
import { buildReport } from './reportData';
import { registerFonts } from './pdf/kit';
import { journalPdf, reportPdf } from './pdf/render';
import { journalDocx, reportDocx } from './docx/docx';
import { rawDataXlsx } from './xlsx/rawDataXlsx';

/** EXPORT_OUT=<тека> — зберегти згенеровані файли для ручного перегляду. */
const OUT = process.env.EXPORT_OUT;

async function bytes(blob: Blob, name: string): Promise<Buffer> {
  const buf = Buffer.from(await blob.arrayBuffer());
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, name), buf);
  }
  return buf;
}

const pdfPages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe('експорт документів', () => {
  let week: Dataset;
  let autumn: Dataset;

  beforeAll(async () => {
    const { history } = await seedDemo();
    week = await loadDataset(history, '2025-11-24', '2025-11-28');
    autumn = await loadDataset(history, '2025-09-01', '2025-11-30');
    registerFonts(`${resolve('public/fonts')}/`);
  });

  it('PDF журналу: рівно 2 сторінки (лицьова й зворот) на кожен день', async () => {
    const days = buildSheetDays(week, true);
    expect(days.length).toBe(5);
    const buf = await bytes(await journalPdf(week.student, days, 'Журнал'), 'journal.pdf');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfPages(buf)).toBe(days.length * 2);
  });

  it('PDF аналітичного звіту формується', async () => {
    const report = buildReport(autumn);
    expect(report.analysis.insights[0].text).toMatch(/^У листопаді дитина показала кращі показники/);
    const buf = await bytes(await reportPdf(autumn.student, 'вересень — листопад 2025', report, [], '22 вересня 2026'), 'report.pdf');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfPages(buf)).toBeGreaterThanOrEqual(3);
  });

  it('DOCX журналу й звіту — коректні zip-архіви Word', async () => {
    const journal = await bytes(await journalDocx(week.student, buildSheetDays(week, true), 'Журнал'), 'journal.docx');
    const report = await bytes(await reportDocx(autumn.student, 'вересень — листопад 2025', buildReport(autumn), [], '22 вересня 2026'), 'report.docx');
    for (const buf of [journal, report]) {
      expect(buf.subarray(0, 2).toString()).toBe('PK');
      expect(buf.toString('latin1')).toContain('word/document.xml');
    }
  });

  it('XLSX із сирими даними: 4 аркуші, рядок на кожен урок', async () => {
    const buf = await bytes(rawDataXlsx(autumn), 'data.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Уроки', 'Дні', 'Місяці', 'Частоти пунктів']);
    const lessons = XLSX.utils.sheet_to_json(wb.Sheets['Уроки']);
    expect(lessons.length).toBe(autumn.lessons.length);
    const months = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Місяці']);
    expect(months.map((m) => m['Місяць'])).toEqual(['вересень 2025', 'жовтень 2025', 'листопад 2025']);
  });
});
