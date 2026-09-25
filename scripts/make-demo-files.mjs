// Готує демо-файли «з Human» для перевірки імпорту: відвідуваність і КТП.
// Запуск: node scripts/make-demo-files.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';

const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const iso = (d) => d.toISOString().slice(0, 10);
const isWeekday = (d) => d.getDay() >= 1 && d.getDay() <= 5;

const today = new Date();
const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
const month = today.getMonth(); // поточний місяць
const daysInMonth = new Date(year, month + 1, 0).getDate();

// --- Облік відвідування: рядок учня × колонки днів місяця ---
const weekdays = [];
for (let d = 1; d <= daysInMonth; d++) {
  const date = new Date(Date.UTC(year, month, d));
  if (isWeekday(date)) weekdays.push(d);
}
const absent1 = weekdays[1];
const absent2 = weekdays[2];
const partial = weekdays[3];
const mark = (day, name) => {
  if (name === 'Андрій К.') {
    if (day === absent1 || day === absent2) return 'н';
    if (day === partial) return 2;
  }
  if (name === 'Бондар Ірина' && day === weekdays[5]) return 'н';
  return null;
};
const students = ['Андрій К.', 'Бондар Ірина', 'Мельник Олег', 'Шевчук Дарина'];
const attendance = [
  [`Облік відвідування. ${MONTHS[month]} ${year}`],
  ['№', 'Учень', ...weekdays],
  ...students.map((name, i) => [i + 1, name, ...weekdays.map((d) => mark(d, name))]),
];

// --- КТП: № / Дата / Тема уроку (дати — найближчі робочі дні) ---
const topics = [
  'Письмове додавання двоцифрових чисел', 'Письмове віднімання двоцифрових чисел', 'Задачі на знаходження суми',
  'Задачі на різницеве порівняння', 'Таблиця множення на 4', 'Таблиця множення на 5',
  'Ділення на 4 і 5', 'Порядок дій у виразах', 'Périметр прямокутника'.replace('Péri', 'Пери'),
  'Площа фігури', 'Одиниці довжини', 'Самостійна робота',
];
const ktp = [['Календарно-тематичне планування. Математика'], ['№', 'Дата', 'Тема уроку']];
let cursor = new Date(Date.UTC(year, today.getMonth(), today.getDate()));
for (let i = 0; i < topics.length; i++) {
  do { cursor = new Date(cursor.getTime() + 86400000); } while (!isWeekday(cursor));
  const [y, m, d] = iso(cursor).split('-');
  ktp.push([i + 1, `${d}.${m}.${y}`, topics[i]]);
}

mkdirSync('demo', { recursive: true });
const save = (rows, sheet, file) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log('written', file);
};
save(attendance, MONTHS[month], 'demo/human-oblik-vidviduvannia.xlsx');
save(ktp, 'КТП', 'demo/human-ktp-matematyka.xlsx');
console.log('відсутності для «Андрій К.»:', [absent1, absent2].join(', '), '· частковий день:', partial);
