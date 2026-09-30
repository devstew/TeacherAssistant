import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useStudents } from '../../state/student';
import { useRepo } from '@journal/core';
import { deleteStudent, exportBackup, getSettings, importBackup, newStudent, parseBackup, saveSettings, saveStudent } from '@journal/core';

import { DEMO_ENABLED, DEMO_IDS, removeDemo, seedDemo } from '../../dev/seed';
import { CATEGORIES, HELP_LEVELS, type Polarity } from '@journal/core';
import { DEFAULT_SETTINGS, type Settings } from '@journal/core';
import { todayISO } from '@journal/core';
import { downloadBlob } from '../../export/download';
import { Button, Card, Field, Input, Notice, PageTitle, Select, Tabs } from '../../components/ui';
import { StudentForm } from './StudentForm';
import { SyncTab } from './SyncTab';
import { useSync } from '../../sync/SyncProvider';

type Tab = 'profile' | 'scoring' | 'data' | 'sync';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Налаштування" />
      <Tabs
        tabs={[
          { id: 'profile', label: 'Профіль дитини' },
          { id: 'scoring', label: 'Показники і ваги' },
          { id: 'data', label: 'Дані й резервна копія' },
          { id: 'sync', label: 'Синхронізація' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'scoring' && <ScoringTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'sync' && <SyncTab />}
    </div>
  );
}

function ProfileTab() {
  const { student, students, setStudentId } = useStudents();
  if (!student) return null;
  return (
    <div className="space-y-4">
      <Card title="Профіль">
        <StudentForm key={student.id} initial={student} onSave={saveStudent} />
      </Card>
      <Card title="Діти">
        <ul className="mb-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {students?.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>
                {s.name} {s.className && <span className="text-slate-500">· {s.className}</span>}
                {s.isDemo && <span className="ml-2 text-xs text-amber-700">демо</span>}
              </span>
              {s.id !== student.id && (
                <Button size="sm" variant="ghost" onClick={() => setStudentId(s.id)}>
                  Вибрати
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const s = newStudent({ name: 'Нова дитина' });
              await saveStudent(s);
              setStudentId(s.id);
            }}
          >
            Додати дитину
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm(`Видалити профіль «${student.name}» разом з усіма спостереженнями? Дію не можна скасувати.`)) return;
              const other = students?.find((s) => s.id !== student.id);
              await deleteStudent(student.id);
              if (other) setStudentId(other.id);
            }}
          >
            Видалити профіль
          </Button>
        </div>
      </Card>
    </div>
  );
}

const POLARITY_OPTIONS: { v: Polarity; label: string }[] = [
  { v: 1, label: '+ позитивний' },
  { v: 0, label: '0 нейтральний' },
  { v: -1, label: '− негативний' },
];

function ScoringTab() {
  const settings = useRepo(getSettings);
  if (!settings) return null;
  const update = (next: Partial<Settings>) => saveSettings({ ...settings, ...next });
  const setOverride = (id: string, patch: { polarity?: Polarity; weight?: number }, def: { polarity: Polarity; weight: number }) => {
    const merged = { ...settings.itemOverrides[id], ...patch };
    const clean: typeof merged = {};
    if (merged.polarity != null && merged.polarity !== def.polarity) clean.polarity = merged.polarity;
    if (merged.weight != null && merged.weight !== def.weight) clean.weight = merged.weight;
    const itemOverrides = { ...settings.itemOverrides };
    if (Object.keys(clean).length) itemOverrides[id] = clean;
    else delete itemOverrides[id];
    update({ itemOverrides });
  };

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Індекс категорії = 50 + 50 × (частка позначених позитивних − частка позначених негативних), з урахуванням ваг. 50 — нейтрально,
        100 — усі позитивні пункти без негативних. Зміни одразу перераховують усю історію: зберігаються лише позначки.
      </Notice>

      {CATEGORIES.filter((c) => c.scored).map((cat) => (
        <Card key={cat.id} title={cat.title}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cat.items.map((item) => {
              const def = { polarity: item.polarity, weight: item.weight ?? 1 };
              const o = settings.itemOverrides[item.id];
              const polarity = o?.polarity ?? def.polarity;
              const weight = o?.weight ?? def.weight;
              const changed = !!o;
              return (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 text-sm">
                  <span className={changed ? 'font-medium text-brand-800 dark:text-brand-200' : ''}>{item.label}</span>
                  <Select
                    aria-label={`Полярність: ${item.label}`}
                    className="h-8 w-36 py-0"
                    value={polarity}
                    onChange={(e) => setOverride(item.id, { polarity: Number(e.target.value) as Polarity }, def)}
                  >
                    {POLARITY_OPTIONS.map((p) => (
                      <option key={p.v} value={p.v}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label={`Вага: ${item.label}`}
                    className="h-8 w-16 py-0"
                    type="number"
                    min={0}
                    max={5}
                    step={0.5}
                    value={weight}
                    onChange={(e) => setOverride(item.id, { weight: Math.max(0, Number(e.target.value) || 0) }, def)}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card title="Самостійність">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Самостійність = 100 × (1 − підтримка), підтримка = зважене середнє рівня допомоги й частки застосованих адаптацій.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Вага рівня допомоги">
            <Input
              type="number"
              step={0.1}
              min={0}
              value={settings.independence.levelWeight}
              onChange={(e) => update({ independence: { ...settings.independence, levelWeight: Number(e.target.value) || 0 } })}
            />
          </Field>
          <Field label="Вага адаптацій">
            <Input
              type="number"
              step={0.1}
              min={0}
              value={settings.independence.adaptWeight}
              onChange={(e) => update({ independence: { ...settings.independence, adaptWeight: Number(e.target.value) || 0 } })}
            />
          </Field>
          {HELP_LEVELS.map((h) => (
            <Field key={h.id} label={`Рівень «${h.label}» (0–1)`}>
              <Input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={Math.round(settings.independence.levels[h.id] * 100) / 100}
                onChange={(e) =>
                  update({
                    independence: {
                      ...settings.independence,
                      levels: { ...settings.independence.levels, [h.id]: Math.min(1, Math.max(0, Number(e.target.value) || 0)) },
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Пороги для висновків">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Мін. уроків у періоді">
            <Input
              type="number"
              min={1}
              value={settings.insights.minLessons}
              onChange={(e) => update({ insights: { ...settings.insights, minLessons: Math.max(1, Number(e.target.value) || 1) } })}
            />
          </Field>
          <Field label="Мін. зміна індексу, п.п.">
            <Input
              type="number"
              min={0}
              value={settings.insights.minDelta}
              onChange={(e) => update({ insights: { ...settings.insights, minDelta: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </Field>
          <Field label="Мін. зміна пункту, п.п.">
            <Input
              type="number"
              min={0}
              value={settings.insights.minItemDelta}
              onChange={(e) => update({ insights: { ...settings.insights, minItemDelta: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </Field>
        </div>
      </Card>

      <Button
        variant="danger"
        onClick={() => {
          if (confirm('Повернути всі ваги й пороги до стандартних?')) saveSettings(DEFAULT_SETTINGS);
        }}
      >
        Скинути до стандартних
      </Button>
    </div>
  );
}

function DataTab() {
  const { student, students, setStudentId } = useStudents();
  const sync = useSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const hasDemo = students?.some((s) => DEMO_IDS.includes(s.id));

  const saveBackup = async (onlyCurrent: boolean) => {
    const b = await exportBackup(onlyCurrent ? student?.id : undefined);
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `Журнал_асистента_копія_${onlyCurrent && student ? `${student.name}_` : ''}${todayISO()}.json`.replace(/\s+/g, '_'));
  };

  return (
    <div className="space-y-4">
      <Card title="Резервна копія">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {sync.email
            ? 'Журнал синхронізується з вашим акаунтом, але копія — єдиний спосіб дістати дані поза застосунком. Під час відновлення записи зливаються: для кожного уроку залишається новіша версія.'
            : 'Дані зберігаються лише в цьому браузері. Регулярно завантажуйте копію — нею ж переносять журнал на інший пристрій. Під час відновлення записи зливаються: для кожного уроку залишається новіша версія.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveBackup(false)}>
            <Download size={16} /> Уся база (JSON)
          </Button>
          <Button onClick={() => saveBackup(true)}>
            <Download size={16} /> Лише поточна дитина
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Відновити з файлу
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const backup = parseBackup(JSON.parse(await file.text()));
                const res = await importBackup(backup);
                setMsg({ tone: 'good', text: `Відновлено: записано ${res.written}, пропущено старіших ${res.skipped}.` });
              } catch (err) {
                setMsg({ tone: 'bad', text: err instanceof Error ? err.message : 'Не вдалося прочитати файл.' });
              }
            }}
          />
        </div>
        {msg && (
          <div className="mt-3">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        )}
      </Card>

      {(DEMO_ENABLED || hasDemo) && (
      <Card title="Демо-дані">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Два профілі: поточний навчальний рік (уроки до сьогодні, останній день заповнений частково) і торішня історія
          вересень–листопад — щоб подивитися дашборд, порівняння місяців і експорт.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ENABLED && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { current } = await seedDemo();
                setStudentId(current.id);
                setBusy(false);
              }}
            >
              {hasDemo ? 'Перестворити демо' : 'Завантажити демо'}
            </Button>
          )}
          {hasDemo && (
            <Button
              variant="danger"
              onClick={async () => {
                const other = students?.find((s) => !DEMO_IDS.includes(s.id));
                await removeDemo();
                if (other) setStudentId(other.id);
              }}
            >
              Видалити демо
            </Button>
          )}
        </div>
        {!DEMO_ENABLED && (
          <p className="mt-3 text-xs text-slate-500">
            Демо вимкнено. Щоб увімкнути, запустіть застосунок зі змінною VITE_ENABLE_DEMO=1.
          </p>
        )}
      </Card>
      )}

      <Card title="Про дані">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Спостереження стосуються дитини з особливими освітніми потребами — це чутливі персональні дані.</li>
          {sync.email ? (
            <li>
              Записи зберігаються в цьому браузері й у вашому обліковому записі ({sync.email}) на захищеному сервері; доступ до
              них має лише цей акаунт.
            </li>
          ) : (
            <li>
              Застосунок нічого не надсилає в інтернет: база живе в IndexedDB цього браузера. Синхронізація вмикається лише
              після вашого входу на вкладці «Синхронізація».
            </li>
          )}
          <li>Очищення даних сайту в браузері видалить журнал — тримайте свіжу резервну копію.</li>
          <li>Для обміну документами зі школою використовуйте експорт PDF/DOCX; ведення журналу погоджуйте з батьками й адміністрацією.</li>
        </ul>
      </Card>
    </div>
  );
}
