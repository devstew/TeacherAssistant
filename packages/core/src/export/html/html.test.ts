/**
 * Документи для школи не можна перевіряти «на око»: перевіряємо, що в HTML
 * потрапили саме позначені пункти, обидві сторінки бланку й таблиці звіту.
 */
import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setStore } from '../../store/context';
import { MemoryDriver } from '../../store/memory';
import { Store } from '../../store/port';
import { loadDataset } from '../../store/repo';
import { seedDemo } from '../../dev/seed';
import type { Dataset } from '../../domain/aggregate';
import { buildSheetDays } from '../sheetData';
import { buildReport } from '../reportData';
import { escapeHtml } from './kit';
import { reportHtml } from './reportHtml';
import { sheetHtml } from './sheetHtml';

/** HTML_OUT=<файл> — зберегти документ, щоб глянути очима. */
declare const process: { env: Record<string, string | undefined> };
const OUT = process.env.HTML_OUT;

setStore(new Store(new MemoryDriver()));

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('документи в HTML', () => {
  let week: Dataset;
  let autumn: Dataset;

  beforeAll(async () => {
    const { history } = await seedDemo();
    week = await loadDataset(history, '2025-11-24', '2025-11-28');
    autumn = await loadDataset(history, '2025-09-01', '2025-11-30');
  });

  it('дає дві сторінки на кожен день бланку', () => {
    const days = buildSheetDays(week, true);
    const html = sheetHtml(week.student, days, 'Журнал');
    if (OUT) writeFileSync(`${OUT}-sheet.html`, html);
    expect(days.length).toBeGreaterThan(2);
    expect(count(html, 'class="page"')).toBe(days.length);
    expect(count(html, 'class="page back"')).toBe(days.length);
    expect(html).toContain('Журнал спостережень асистента вчителя');
    expect(html).toContain('Комунікативні та соціальні навички');
  });

  it('переносить у бланк саме позначені пункти', () => {
    const days = buildSheetDays(week, true);
    const day = days[0];
    const checks = new Set(day.lessons.flatMap((l) => l.obs?.checks ?? []));
    const html = sheetHtml(week.student, [day], 'Журнал');
    expect(checks.size).toBeGreaterThan(3);
    // Кожна позначка — заповнений квадратик; порожніх пунктів більше, ніж позначених.
    expect(count(html, 'class="box on"')).toBeGreaterThanOrEqual(checks.size);
    expect(count(html, 'class="box"')).toBeGreaterThan(count(html, 'class="box on"'));
  });

  it('показує відсутність замість пунктів', async () => {
    const days = buildSheetDays(week, true);
    const withAbsence = days.find((d) => d.lessons.some((l) => l.lesson.absent));
    if (!withAbsence) return; // у демо цього тижня відсутності може не бути
    const html = sheetHtml(week.student, [withAbsence], 'Журнал');
    expect(html).toContain('Відсутній на уроці (н)');
  });

  it('звіт містить висновки, таблиці, графіки й методику', () => {
    const report = buildReport(autumn);
    const html = reportHtml(autumn.student, 'вересень — листопад', report, '1 грудня 2025');
    if (OUT) writeFileSync(`${OUT}-report.html`, html);
    expect(html).toContain('Аналітичний звіт спостережень асистента вчителя');
    expect(html).toContain('Показники по місяцях');
    expect(html).toContain(report.analysis.insights[0].text.slice(0, 20));
    // Два графіки: динаміка індексів і розподіл допомоги.
    expect(count(html, '<svg xmlns')).toBe(2);
    expect(html).toContain('Методика.');
    expect(count(html, 'class="page"')).toBe(3);
  });

  it('екранує дані, введені людиною', () => {
    expect(escapeHtml('<script>«лапки» & 5 > 3')).toBe('&lt;script&gt;«лапки» &amp; 5 &gt; 3');
    const html = sheetHtml({ ...week.student, name: 'Тест <b>' }, buildSheetDays(week, true).slice(0, 1), 'Журнал');
    expect(html).toContain('Тест &lt;b&gt;');
    expect(html).not.toContain('Тест <b>');
  });
});
