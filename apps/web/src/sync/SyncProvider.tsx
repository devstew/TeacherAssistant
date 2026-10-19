import type { ReactNode } from 'react';
import { friendlyError, providerEnabled, SyncProvider as CoreSyncProvider, withoutOAuthParams, type GoogleSignIn, type SyncTriggers } from '@journal/core';
import { supabase } from './client';

export { useSync } from '@journal/core';

/** Приводи синхронізуватися у браузері: повернення до вкладки й поява мережі. */
const browserTriggers: SyncTriggers = (sync) => {
  const onVisible = () => {
    if (document.visibilityState === 'visible') sync();
  };
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', onVisible);
  };
};

/** Вхід через Google у браузері: сторінка йде на Google і повертається сюди ж із ?code=…. */
const google: GoogleSignIn = async (client) => {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  if (error) throw new Error(friendlyError(error.message));
};

const googleEnabled = () => providerEnabled(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, 'google');

// Адреса першого завантаження: якщо це повернення з Google, у ній код.
const firstUrl = window.location.href;
const forgetCode = () => window.history.replaceState(window.history.state, '', withoutOAuthParams(window.location.href));

export function SyncProvider({ children }: { children: ReactNode }) {
  return (
    <CoreSyncProvider client={supabase} triggers={browserTriggers} google={google} googleEnabled={googleEnabled} returnUrl={firstUrl} onReturnHandled={forgetCode}>
      {children}
    </CoreSyncProvider>
  );
}
