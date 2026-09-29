import { useEffect, useState, type FormEvent } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { clearConflicts, friendlyError, getStore, listConflicts, type Conflict, type SyncStatus, type Tbl } from '@journal/core';
import { useSync } from '../../sync/SyncProvider';
import { Badge, Button, Card, Field, Input, Notice } from '../../components/ui';

const TABLE_LABEL: Record<Tbl, string> = {
  students: 'Профіль',
  timetable: 'Розклад',
  holidays: 'Вихідні',
  lessons: 'Урок',
  lessonObs: 'Спостереження на уроці',
  dayObs: 'Підсумок дня',
  settings: 'Налаштування',
};

const time = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—';

export function SyncTab() {
  const { configured, email, status, codeSentTo, accountMismatch, signIn, verify, signOut, syncNow, wipeAndUseAccount } = useSync();

  if (!configured) {
    return (
      <Card title="Синхронізація між пристроями">
        <Notice tone="info">
          У цій збірці синхронізація вимкнена: журнал зберігається лише в цьому браузері. Щоб увімкнути, задайте змінні
          VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY.
        </Notice>
      </Card>
    );
  }

  if (accountMismatch) {
    return (
      <Card title="Інший акаунт">
        <Notice tone="warn">
          На цьому пристрої вже є журнал іншого користувача. Дані двох асистентів зливати не можна — це записи про різних
          дітей.
        </Notice>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Спершу збережіть резервну копію на вкладці «Дані й резервна копія», потім очистіть пристрій — і журнал
          завантажиться з вашого акаунта.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Стерти всі дані на цьому пристрої й завантажити журнал вашого акаунта? Дію не можна скасувати.'))
                void wipeAndUseAccount();
            }}
          >
            Очистити пристрій і увійти
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Вийти
          </Button>
        </div>
      </Card>
    );
  }

  return email ? (
    <SignedIn
      email={email}
      status={status}
      onSync={syncNow}
      onSignOut={signOut}
    />
  ) : (
    <SignIn codeSentTo={codeSentTo} onSignIn={signIn} onVerify={verify} />
  );
}

function SignIn({
  codeSentTo,
  onSignIn,
  onVerify,
}: {
  codeSentTo?: string;
  onSignIn: (email: string) => Promise<void>;
  onVerify: (code: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося виконати дію.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(codeSentTo ? () => onVerify(code) : () => onSignIn(email.trim()));
  };

  return (
    <Card title="Синхронізація між пристроями">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Увійдіть, щоб журнал був і на телефоні, і на комп'ютері. Записи зберігаються в захищеній базі: їх бачите лише ви.
        Без входу застосунок працює як раніше — тільки на цьому пристрої.
      </p>
      {/* Поки обмін не пройшов перевірку на справжньому сервері, попереджаємо про це прямо тут. */}
      <div className="mb-3">
        <Notice tone="warn">
          Синхронізація ще не перевірена вживу. Перед першим входом збережіть резервну копію на вкладці «Дані й резервна
          копія».
        </Notice>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        {codeSentTo ? (
          <>
            <Field label={`Код з листа на ${codeSentTo}`}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                Увійти
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(() => onSignIn(codeSentTo))}>
                Надіслати код ще раз
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Робоча пошта">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="assistant@school.ua"
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Надіслати код
            </Button>
          </>
        )}
      </form>
      {error && (
        <div className="mt-3">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
    </Card>
  );
}

function SignedIn({
  email,
  status,
  onSync,
  onSignOut,
}: {
  email: string;
  status: SyncStatus;
  onSync: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <Card
        title="Синхронізація"
        actions={
          status.state === 'syncing' ? (
            <Badge tone="info">обмін даними…</Badge>
          ) : status.state === 'error' ? (
            <Badge tone="bad">помилка</Badge>
          ) : status.pending ? (
            <Badge tone="warn">чекає {status.pending}</Badge>
          ) : (
            <Badge tone="good">усе збережено</Badge>
          )
        }
      >
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-slate-500">Акаунт</dt>
            <dd className="font-medium">{email}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-slate-500">Останній обмін</dt>
            <dd className="font-medium">{time(status.lastSyncAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-slate-500">Не надіслано змін</dt>
            <dd className="font-medium">{status.pending}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-slate-500">Конфліктів</dt>
            <dd className="font-medium">{status.conflicts}</dd>
          </div>
        </dl>
        {status.error && (
          <div className="mt-3">
            <Notice tone="bad">{friendlyError(status.error)}</Notice>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void onSync()} disabled={status.state === 'syncing'}>
            <RefreshCw size={16} /> Синхронізувати зараз
          </Button>
          <Button variant="ghost" onClick={() => void onSignOut()}>
            <CloudOff size={16} /> Вийти
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Після виходу журнал залишається на цьому пристрої, але нові записи вже не потраплятимуть на інші пристрої.
        </p>
      </Card>

      {status.conflicts > 0 && <Conflicts count={status.conflicts} />}
    </div>
  );
}

/**
 * Записи, які програли конфлікт: на іншому пристрої той самий урок змінили пізніше.
 * Їх показуємо поіменно — мовчазна втрата денних спостережень неприпустима.
 */
function Conflicts({ count }: { count: number }) {
  const [rows, setRows] = useState<(Conflict & { date?: string })[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const store = getStore();
      const list = await listConflicts(store);
      const withDates = await Promise.all(
        list.map(async (c) => {
          const row = await store.get(c.table, c.id, { includeDeleted: true });
          return { ...c, date: (row as { date?: string } | undefined)?.date };
        }),
      );
      if (alive) setRows(withDates);
    })();
    return () => {
      alive = false;
    };
  }, [count]);

  return (
    <Card
      title="Конфлікти"
      actions={
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await clearConflicts(getStore());
            setRows([]);
          }}
        >
          Очистити список
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Ці записи змінювали на двох пристроях одночасно. Залишилася версія з пізнішим часом — перевірте їх і за потреби
        заповніть ще раз.
      </p>
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {rows.map((c) => (
          <li key={`${c.table}:${c.id}:${c.at}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span>
              {TABLE_LABEL[c.table]}
              {c.date && <span className="text-slate-500"> · {c.date}</span>}
            </span>
            <span className="text-xs text-slate-500">ваша версія {time(c.localUpdatedAt)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
