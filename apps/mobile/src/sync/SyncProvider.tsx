import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { finishOAuth, friendlyError, parseOAuthReturn, providerEnabled, SyncProvider as CoreSyncProvider, type GoogleSignIn, type SyncTriggers } from '@journal/core';
import { supabase } from './client';

export { useSync } from '@journal/core';

/** На телефоні привід синхронізуватися один: застосунок повернувся з фону. */
const appTriggers: SyncTriggers = (sync) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') sync();
  });
  return () => sub.remove();
};

/**
 * Вхід через Google на телефоні: сторінка Google відкривається у вбудованому
 * браузері, а повертає назад адреса journal://auth?code=…; код міняємо на сесію тут же.
 */
const google: GoogleSignIn = async (client) => {
  const redirectTo = Linking.createURL('auth');
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw new Error(friendlyError(error?.message ?? 'Не вдалося почати вхід через Google.'));
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // закрили вікно — нічого не сталося
  const message = await finishOAuth(client, parseOAuthReturn(result.url));
  if (message) throw new Error(message);
};

const googleEnabled = () => providerEnabled(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'google');

export function SyncProvider({ children }: { children: ReactNode }) {
  // У фоні таймер оновлення токена не працює — Supabase просить вимикати його явно.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const apply = (state: string) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    apply(AppState.currentState);
    const sub = AppState.addEventListener('change', apply);
    return () => sub.remove();
  }, []);

  return (
    <CoreSyncProvider client={supabase} triggers={appTriggers} google={google} googleEnabled={googleEnabled}>
      {children}
    </CoreSyncProvider>
  );
}
