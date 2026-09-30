/**
 * Щоденні аркуші як HTML — копія паперового бланку: сторінка 1 (навчальна
 * діяльність, увага/емоційний стан, поведінка) і сторінка 2 (взаємодія
 * з вчителем і асистентом, комунікативні навички, примітка).
 * Понад п'ять уроків — наступний аркуш, як і на папері.
 */
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
} from '../../domain/formSchema';
import type { Student } from '../../domain/types';
import { LESSONS_PER_SHEET, chunk, dayTitle, studentLine, type SheetDay, type SheetLesson } from '../sheetData';
import { MUTED, box, escapeHtml, htmlDocument, item } from './kit';

const SHEET_CSS = `
  .front td:nth-child(1), .front th:nth-child(1) { width: 19%; }
  .front td:nth-child(2), .front th:nth-child(2) { width: 41%; }
  .front td:nth-child(3), .front th:nth-child(3) { width: 20%; }
  .front td:nth-child(4), .front th:nth-child(4) { width: 20%; }
  .back { font-size: 7.1pt; }
  .back .interaction { width: 72%; }
  .back .side { width: 28%; border-left: 0; }
  .back .interaction td:nth-child(1) { width: 42%; }
  .back .interaction td:nth-child(2) { width: 58%; }
  .caption { font-size: 6.8pt; color: ${MUTED}; margin-bottom: 2pt; }
  .note-line { border-bottom: 0.5pt solid #b5b4ae; height: 11pt; }
  .side-title { font-size: 6pt; text-align: center; font-weight: 400; }
  .foot { display: flex; justify-content: space-between; font-size: 6.5pt; color: ${MUTED}; margin-top: 6pt; }
`;

const items = (cat: CategoryDef, checks: Set<string>): string =>
  cat.items.map((i) => item(checks.has(i.id), i.label)).join('');

const absent = '<div class="muted">Відсутній на уроці (н)</div>';

function header(student: Student, day: SheetDay, part: string): string {
  return `<div class="head">
    <div>
      <div class="title">Журнал спостережень асистента вчителя</div>
      <div class="sub">${escapeHtml(studentLine(student))}</div>
    </div>
    <div>
      <div class="date">${escapeHtml(dayTitle(day.date))}</div>
      <div class="sub" style="text-align:right">${escapeHtml(part)}</div>
    </div>
  </div>`;
}

function lessonInfo(l: SheetLesson): string {
  return `<div class="bold" style="font-size:8.5pt">Урок ${l.lesson.lessonNumber}</div>
    ${l.time ? `<div class="muted">${escapeHtml(l.time.start)}–${escapeHtml(l.time.end)}</div>` : ''}
    <div class="bold" style="margin-top:2pt">${escapeHtml(l.lesson.subject)}</div>
    ${l.lesson.topic ? `<div style="margin-top:2pt">Тема: ${escapeHtml(l.lesson.topic)}</div>` : ''}
    ${l.lesson.absent ? `<div class="bold" style="margin-top:3pt">${escapeHtml(l.lesson.absenceMarker ?? 'н')} — відсутній</div>` : ''}`;
}

function frontPage(student: Student, day: SheetDay, lessons: SheetLesson[], part: string): string {
  const rows = lessons.length
    ? lessons
        .map((l) => {
          const checks = new Set(l.obs?.checks ?? []);
          const away = !!l.lesson.absent;
          const attention = away
            ? absent
            : `${items(ATTENTION, checks)}
               ${l.obs?.attentionMinutes != null ? `<div style="margin-bottom:1.5pt">Утримує увагу: ${l.obs.attentionMinutes} хв</div>` : ''}
               <div class="sep"></div>${items(EMOTION, checks)}`;
          return `<tr>
            <td>${lessonInfo(l)}</td>
            <td>${away ? absent : items(LEARNING, checks)}</td>
            <td>${attention}</td>
            <td>${away ? absent : items(BEHAVIOR, checks)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="4" class="muted">Уроків цього дня немає.</td></tr>';

  return `<div class="page">
    ${header(student, day, part)}
    <table class="front">
      <thead><tr>
        <th class="beige">Урок / тема</th>
        <th>Навчальна діяльність</th>
        <th>Увага / Емоційний стан</th>
        <th>Поведінка</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot"><span>${escapeHtml(`${student.name} · ${dayTitle(day.date)}`)}</span></div>
  </div>`;
}

function assistantCell(l: SheetLesson): string {
  const checks = new Set(l.obs?.checks ?? []);
  const [org, ...adaptations] = ASSISTANT.items;
  return `<div class="label">Допомога асистента була потрібна:</div>
    <div style="display:flex;flex-wrap:wrap;gap:5pt;margin-bottom:2pt">
      ${PAPER_HELP_ORDER.map(
        (h) => `<span class="item" style="margin:0">${box(l.obs?.helpLevel === h)}<span>${escapeHtml(HELP_LABEL[h])}</span></span>`,
      ).join('')}
    </div>
    ${item(checks.has(org.id), org.label)}
    <div class="label">Адаптація:</div>
    <div class="two-col">${adaptations.map((i) => `<div>${item(checks.has(i.id), i.label)}</div>`).join('')}</div>
    ${l.obs?.comment ? `<div style="margin-top:2pt">Коментар: ${escapeHtml(l.obs.comment)}</div>` : ''}`;
}

function backPage(student: Student, day: SheetDay, lessons: SheetLesson[], part: string, withSocial: boolean): string {
  const social = new Set(day.day?.checks ?? []);
  let prevSection: string | undefined;
  const socialItems = SOCIAL.items
    .map((i) => {
      const heading = i.section && i.section !== prevSection ? `<div class="label">${escapeHtml(i.section)}:</div>` : '';
      prevSection = i.section;
      return heading + item(social.has(i.id), i.label);
    })
    .join('');

  const rows = lessons
    .map((l) => {
      const checks = new Set(l.obs?.checks ?? []);
      return `<tr>
        <td>
          <div class="caption">Урок ${l.lesson.lessonNumber} · ${escapeHtml(l.lesson.subject)}</div>
          ${l.lesson.absent ? absent : items(TEACHER, checks)}
        </td>
        <td>${l.lesson.absent ? absent : assistantCell(l)}</td>
      </tr>`;
    })
    .join('');

  return `<div class="page back">
    ${header(student, day, part)}
    <div class="row">
      <table class="interaction">
        <thead>
          <tr><th colspan="2">Взаємодія</th></tr>
          <tr><th>з вчителем</th><th>з асистентом вчителя</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="2" class="muted">Уроків цього дня немає.</td></tr>'}</tbody>
      </table>
      <table class="side">
        <tbody>
          <tr><th class="beige">Комунікативні та соціальні навички</th></tr>
          <tr><td>${withSocial ? socialItems : '<span class="muted">Див. перший аркуш цього дня.</span>'}</td></tr>
          <tr><th>Примітка<div class="side-title">(досягнення, труднощі, навички самообслуговування, рекомендації)</div></th></tr>
          <tr><td>${
            withSocial && day.day?.note
              ? escapeHtml(day.day.note)
              : Array.from({ length: 8 }, () => '<div class="note-line"></div>').join('')
          }</td></tr>
        </tbody>
      </table>
    </div>
    <div class="foot"><span>${escapeHtml(`${student.name} · ${dayTitle(day.date)}`)}</span></div>
  </div>`;
}

export function sheetHtml(student: Student, days: SheetDay[], title: string): string {
  const body = days
    .flatMap((day) => {
      const sheets = chunk(day.lessons, LESSONS_PER_SHEET);
      return sheets.flatMap((lessons, i) => {
        const part = sheets.length > 1 ? `аркуш ${i + 1} з ${sheets.length}` : '';
        return [
          frontPage(student, day, lessons, part),
          backPage(student, day, lessons, part ? `${part} · зворот` : 'зворот', i === 0),
        ];
      });
    })
    .join('');
  return htmlDocument(title, SHEET_CSS, body);
}
