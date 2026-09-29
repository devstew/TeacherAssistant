import type { ReactNode } from 'react';
import { SyncProvider as CoreSyncProvider, type SyncTriggers } from '@journal/core';
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

export function SyncProvider({ children }: { children: ReactNode }) {
  return (
    <CoreSyncProvider client={supabase} triggers={browserTriggers}>
      {children}
    </CoreSyncProvider>
  );
}
