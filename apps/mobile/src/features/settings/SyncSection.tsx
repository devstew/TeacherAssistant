import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import {
  clearConflicts,
  friendlyError,
  getStore,
  listConflicts,
  type Conflict,
  type SyncStatus,
  type Tbl,
} from '@journal/core';
import { Badge, Button, Card, Field, Input, Notice } from '@/components/ui';
import { useSync } from '@/sync/SyncProvider';
import { font, sp, useTheme } from '@/theme';

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

export function SyncSection() {
  const { configured, email, status, codeSentTo, accountMismatch, signIn, verify, signOut, syncNow, wipeAndUseAccount } =
    useSync();

  if (!configured)
    return (
      <Card title="Синхронізація між пристроями">
        <Notice tone="info">
          У цій збірці синхронізація вимкнена: журнал зберігається лише на цьому телефоні. Щоб увімкнути, задайте змінні
          EXPO_PUBLIC_SUPABASE_URL і EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Notice>
      </Card>
    );

  if (accountMismatch) return <Mismatch onWipe={wipeAndUseAccount} onSignOut={signOut} />;

  return email ? (
    <SignedIn email={email} status={status} onSync={syncNow} onSignOut={signOut} />
  ) : (
    <SignIn codeSentTo={codeSentTo} onSignIn={signIn} onVerify={verify} />
  );
}

function Mismatch({ onWipe, onSignOut }: { onWipe: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const t = useTheme();
  return (
    <Card title="Інший акаунт">
      <View style={{ gap: sp.md }}>
        <Notice tone="warn">
          На цьому телефоні вже є журнал іншого користувача. Дані двох асистентів зливати не можна — це записи про різних
          дітей.
        </Notice>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Спершу збережіть резервну копію, потім очистіть пристрій — і журнал завантажиться з вашого акаунта.
        </Text>
        <Button
          variant="danger"
          onPress={() =>
            Alert.alert('Очистити пристрій?', 'Усі записи на цьому телефоні буде стерто. Дію не можна скасувати.', [
              { text: 'Скасувати', style: 'cancel' },
              { text: 'Очистити', style: 'destructive', onPress: () => void onWipe() },
            ])
          }
        >
          Очистити пристрій і увійти
        </Button>
        <Button variant="ghost" onPress={() => void onSignOut()}>
          Вийти
        </Button>
      </View>
    </Card>
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
  const t = useTheme();
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
      setError(e instanceof Error ? friendlyError(e.message) : 'Не вдалося виконати дію.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Синхронізація між пристроями">
      <View style={{ gap: sp.md }}>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Увійдіть, щоб журнал був і на телефоні, і на комп’ютері. Записи зберігаються в захищеній базі: їх бачите лише ви.
        </Text>

        {codeSentTo ? (
          <>
            <Field label={`Код з листа на ${codeSentTo}`}>
              <Input
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                placeholder="123456"
              />
            </Field>
            <Button variant="primary" disabled={busy} onPress={() => void run(() => onVerify(code))}>
              Увійти
            </Button>
            <Button variant="ghost" disabled={busy} onPress={() => void run(() => onSignIn(codeSentTo))}>
              Надіслати код ще раз
            </Button>
          </>
        ) : (
          <>
            <Field label="Робоча пошта">
              <Input
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="assistant@school.ua"
              />
            </Field>
            <Button variant="primary" disabled={busy || !email.trim()} onPress={() => void run(() => onSignIn(email.trim()))}>
              Надіслати код
            </Button>
          </>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
      </View>
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
  const t = useTheme();
  const rows: [string, string][] = [
    ['Акаунт', email],
    ['Останній обмін', time(status.lastSyncAt)],
    ['Не надіслано змін', String(status.pending)],
    ['Конфліктів', String(status.conflicts)],
  ];

  return (
    <View style={{ gap: sp.lg }}>
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
        <View style={{ gap: sp.sm }}>
          {rows.map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md }}>
              <Text style={{ color: t.muted, fontSize: font.sm }}>{label}</Text>
              <Text style={{ color: t.text, fontSize: font.sm, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
          {status.error && <Notice tone="bad">{friendlyError(status.error)}</Notice>}
          <Button
            variant="primary"
            disabled={status.state === 'syncing'}
            icon={<RefreshCw color={t.onBrand} size={16} />}
            onPress={() => void onSync()}
          >
            Синхронізувати зараз
          </Button>
          <Button variant="ghost" icon={<CloudOff color={t.subtle} size={16} />} onPress={() => void onSignOut()}>
            Вийти
          </Button>
        </View>
      </Card>

      {status.conflicts > 0 && <Conflicts count={status.conflicts} />}
    </View>
  );
}

/** Записи, які програли конфлікт: мовчазна втрата денних спостережень неприпустима. */
function Conflicts({ count }: { count: number }) {
  const t = useTheme();
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
          onPress={async () => {
            await clearConflicts(getStore());
            setRows([]);
          }}
        >
          Очистити
        </Button>
      }
    >
      <View style={{ gap: sp.sm }}>
        <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
          Ці записи змінювали на двох пристроях одночасно. Залишилася версія з пізнішим часом — перевірте їх.
        </Text>
        {rows.map((c) => (
          <View key={`${c.table}:${c.id}:${c.at}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.sm }}>
            <Text style={{ color: t.text, fontSize: font.sm, flexShrink: 1 }}>
              {TABLE_LABEL[c.table]}
              {c.date ? ` · ${c.date}` : ''}
            </Text>
            <Text style={{ color: t.muted, fontSize: font.xs }}>ваша версія {time(c.localUpdatedAt)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
