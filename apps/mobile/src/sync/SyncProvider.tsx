import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { SyncProvider as CoreSyncProvider, type SyncTriggers } from '@journal/core';
import { supabase } from './client';

export { useSync } from '@journal/core';

/** На телефоні привід синхронізуватися один: застосунок повернувся з фону. */
const appTriggers: SyncTriggers = (sync) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') sync();
  });
  return () => sub.remove();
};

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
    <CoreSyncProvider client={supabase} triggers={appTriggers}>
      {children}
    </CoreSyncProvider>
  );
}
