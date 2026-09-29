import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  SyncEngine,
  adoptLocalData,
  checkAccount,
  getStore,
  onChanged,
  resetForOwner,
  supabaseBackend,
  type SyncStatus,
} from '@journal/core';
import { supabase, syncConfigured } from './client';
import { friendlyError } from './errors';

interface SyncContextValue {
  configured: boolean;
  email?: string;
  status: SyncStatus;
  /** Пошта, на яку надіслано код. */
  codeSentTo?: string;
  /** Інший акаунт на цьому пристрої: зливати дані не можна. */
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

export function SyncProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(idle);
  const [codeSentTo, setCodeSentTo] = useState<string>();
  const [accountMismatch, setAccountMismatch] = useState<string>();
  const [reload, setReload] = useState(0);
  const engine = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Поки користувач не увійшов, застосунок працює локально, як і раніше.
  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) {
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

      const sync = new SyncEngine(store, supabaseBackend(supabase));
      engine.current = sync;
      offs.push(sync.subscribe(setStatus));
      offs.push(onChanged(() => sync.schedule()));

      const onOnline = () => void sync.sync();
      const onVisible = () => {
        if (document.visibilityState === 'visible') void sync.sync();
      };
      window.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      offs.push(() => window.removeEventListener('online', onOnline));
      offs.push(() => document.removeEventListener('visibilitychange', onVisible));

      void sync.sync();
    })();

    return () => {
      cancelled = true;
      for (const off of offs) off();
      offs.length = 0;
      engine.current = null;
    };
  }, [userId, reload]);

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await failsafe(supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }));
    if (error) throw new Error(friendlyError(error.message));
    setCodeSentTo(email);
  }, []);

  const verify = useCallback(
    async (code: string) => {
      if (!supabase || !codeSentTo) return;
      const { error } = await failsafe(supabase.auth.verifyOtp({ email: codeSentTo, token: code.trim(), type: 'email' }));
      if (error) throw new Error(friendlyError(error.message));
      setCodeSentTo(undefined);
    },
    [codeSentTo],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setStatus(idle);
  }, []);

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
      configured: syncConfigured,
      email: session?.user.email ?? undefined,
      status,
      codeSentTo,
      accountMismatch,
      signIn,
      verify,
      signOut,
      syncNow,
      wipeAndUseAccount,
    }),
    [session, status, codeSentTo, accountMismatch, signIn, verify, signOut, syncNow, wipeAndUseAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Без мережі supabase-js кидає виняток — зводимо обидва шляхи до одного вигляду. */
async function failsafe<T extends { error: { message: string } | null }>(p: Promise<T>): Promise<{ error: { message: string } | null }> {
  try {
    return await p;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export const useSync = () => useContext(Ctx);
