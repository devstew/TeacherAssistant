import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { BarChart3, CalendarDays, FileDown, NotebookPen, Settings as SettingsIcon } from 'lucide-react';
import { useStudents } from './state/student';
import { cx, Select } from './components/ui';
import TodayPage from './features/today/TodayPage';
import LessonPage from './features/observe/LessonPage';
import DayPage from './features/observe/DayPage';
import SchedulePage from './features/schedule/SchedulePage';
import SettingsPage from './features/settings/SettingsPage';
import Welcome from './features/settings/Welcome';

// Дашборд і експорт тягнуть важкі бібліотеки — вантажимо їх окремо.
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ExportPage = lazy(() => import('./features/export/ExportPage'));

const NAV = [
  { to: '/', label: 'Сьогодні', icon: NotebookPen, end: true },
  { to: '/schedule', label: 'Розклад', icon: CalendarDays },
  { to: '/dashboard', label: 'Дашборд', icon: BarChart3 },
  { to: '/export', label: 'Експорт', icon: FileDown },
  { to: '/settings', label: 'Налаштування', icon: SettingsIcon },
];

export default function App() {
  const { students, student, setStudentId } = useStudents();

  if (!students) return <div className="p-6 text-sm text-slate-500">Завантаження…</div>;
  if (!student) return <Welcome />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <img src="./icon.svg" alt="" className="h-7 w-7" />
          <span className="hidden font-semibold sm:inline">Журнал асистента</span>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Розділи">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )
                }
              >
                <Icon size={16} aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto w-44 sm:w-56">
            <Select aria-label="Дитина" value={student.id} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || 'Без імені'} {s.className && `· ${s.className}`}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>

      <main className="pb-nav mx-auto max-w-6xl px-4 pt-4">
        <Suspense fallback={<div className="p-6 text-sm text-slate-500">Завантаження…</div>}>
          <Routes>
            <Route path="/" element={<TodayPage key={student.id} />} />
            <Route path="/day/:date" element={<DayPage key={student.id} />} />
            <Route path="/day/:date/lesson/:n" element={<LessonPage key={student.id} />} />
            <Route path="/schedule" element={<SchedulePage key={student.id} />} />
            <Route path="/dashboard" element={<DashboardPage key={student.id} />} />
            <Route path="/export" element={<ExportPage key={student.id} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>

      <nav
        aria-label="Розділи"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400',
                )
              }
            >
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
