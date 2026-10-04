/**
 * Стан синхронізації для інтерфейсу: сесія, рушій обміну й вхід поштою.
 *
 * Логіка спільна для вебу й телефона — розходяться лише дві дрібниці, і вони
 * передаються ззовні: звідки береться клієнт Supabase і що вважати приводом
 * синхронізуватися (поява мережі у браузері, повернення застосунку з фону).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '../store/context';
import { onChanged } from '../store/events';
import { adoptLocalData, checkAccount, resetForOwner } from '../sync/account';
import { SyncEngine } from '../sync/engine';
import { friendlyError } from '../sync/errors';
import { parseSignInInput } from '../sync/signInInput';
import { supabaseBackend } from '../sync/supabase';
import type { SyncStatus } from '../sync/types';

/** Повертає функцію відписки; `sync` можна смикати скільки завгодно. */
export type SyncTriggers = (sync: () => void) => () => void;

export interface SyncContextValue {
  /** Чи є в цій збірці ключі сервера. Без них застосунок працює лише локально. */
  configured: boolean;
  email?: string;
  status: SyncStatus;
  /** Пошта, на яку надіслано код. */
  codeSentTo?: string;
  /** На пристрої журнал іншого акаунта: зливати їх не можна. */
  accountMismatch?: string;
  signIn: (email: string) => Promise<void>;
  verify: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  wipeAndUseAccount: () => Promise<void>;
}

const idle: SyncStatus = { state: 'idle', pending: 0, conflicts: 0 };

const Ctx = createContext<SyncContextValue>({
  configured: false,
  status: idle,
  signIn: async () => {},
  verify: async () => {},
  signOut: async () => {},
  syncNow: async () => {},
  wipeAndUseAccount: async () => {},
});

export function SyncProvider({
  client,
  triggers,
  children,
}: {
  client: SupabaseClient | null;
  triggers?: SyncTriggers;
  children: ReactNode;
}) {
  const [userId, setUserId] = useState<string>();
  const [email, setEmail] = useState<string>();
  const [status, setStatus] = useState<SyncStatus>(idle);
  const [codeSentTo, setCodeSentTo] = useState<string>();
  const [accountMismatch, setAccountMismatch] = useState<string>();
  const [reload, setReload] = useState(0);
  const engine = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (!client) return;
    const remember = (user?: { id: string; email?: string }) => {
      setUserId(user?.id);
      setEmail(user?.email);
    };
    void client.auth.getSession().then(({ data }) => remember(data.session?.user));
    // Оновлення токена не має перезапускати обмін, тому стежимо лише за тим, хто увійшов.
    const { data } = client.auth.onAuthStateChange((_event, session) => remember(session?.user));
    return () => data.subscription.unsubscribe();
  }, [client]);

  // Поки користувач не увійшов, застосунок працює лише на цьому пристрої.
  useEffect(() => {
    if (!client || !userId) {
      engine.current = null;
      setStatus(idle);
      return;
    }
    let cancelled = false;
    const offs: (() => void)[] = [];

    void (async () => {
      const store = getStore();
      const check = await checkAccount(store, userId);
      if (cancelled) return;
      if (check.kind === 'mismatch') {
        setAccountMismatch(check.previousOwner);
        return;
      }
      setAccountMismatch(undefined);
      // Дані, набрані до входу, стають даними цього акаунта й вирушають на сервер.
      if (check.kind === 'adopt') await adoptLocalData(store, userId);
      if (cancelled) return;

      const sync = new SyncEngine(store, supabaseBackend(client));
      engine.current = sync;
      offs.push(sync.subscribe(setStatus));
      offs.push(onChanged(() => sync.schedule()));
      if (triggers) offs.push(triggers(() => void sync.sync()));

      void sync.sync();
    })();

    return () => {
      cancelled = true;
      for (const off of offs) off();
      offs.length = 0;
      engine.current = null;
    };
  }, [client, userId, reload, triggers]);

  const signIn = useCallback(
    async (address: string) => {
      if (!client) return;
      const { error } = await failsafe(
        client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } }),
      );
      if (error) throw new Error(friendlyError(error.message));
      setCodeSentTo(address);
    },
    [client],
  );

  const verify = useCallback(
    async (input: string) => {
      if (!client) return;
      const parsed = parseSignInInput(input);
      if (!parsed) throw new Error('Вставте код або посилання з листа.');
      // Код прив'язаний до адреси, посилання — самодостатнє: ним можна увійти
      // й тоді, коли лист прийшов на іншому пристрої, а запит робили не тут.
      if (parsed.kind === 'code' && !codeSentTo) throw new Error('Спершу надішліть код на пошту.');
      const { error } = await failsafe(
        parsed.kind === 'code'
          ? client.auth.verifyOtp({ email: codeSentTo!, token: parsed.code, type: 'email' })
          : client.auth.verifyOtp({ token_hash: parsed.tokenHash, type: 'email' }),
      );
      if (error) throw new Error(friendlyError(error.message));
      setCodeSentTo(undefined);
    },
    [client, codeSentTo],
  );

  const signOut = useCallback(async () => {
    await client?.auth.signOut();
    setStatus(idle);
  }, [client]);

  const syncNow = useCallback(async () => {
    await engine.current?.sync();
  }, []);

  const wipeAndUseAccount = useCallback(async () => {
    if (!userId) return;
    // Пристрій переходить новому власнику цілком: чужі записи стираються,
    // далі журнал завантажиться з сервера.
    await resetForOwner(getStore(), userId);
    setAccountMismatch(undefined);
    setReload((n) => n + 1);
  }, [userId]);

  const value = useMemo<SyncContextValue>(
    () => ({
      configured: !!client,
      email,
      status,
      codeSentTo,
      accountMismatch,
      signIn,
      verify,
      signOut,
      syncNow,
      wipeAndUseAccount,
    }),
    [client, email, status, codeSentTo, accountMismatch, signIn, verify, signOut, syncNow, wipeAndUseAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Без мережі supabase-js кидає виняток — зводимо обидва шляхи до одного вигляду. */
async function failsafe<T extends { error: { message: string } | null }>(
  p: Promise<T>,
): Promise<{ error: { message: string } | null }> {
  try {
    return await p;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export const useSync = () => useContext(Ctx);
