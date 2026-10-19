import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Без ключів застосунок працює як і раніше — тільки на цьому пристрої. */
export const syncConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url as string, anonKey as string, {
      // PKCE: Google повертає ?code=… у query, а не токени після «#», де живе маршрут HashRouter.
      // Обмін коду робить SyncProvider сам, тож автоматичний розбір адреси вимкнено.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
    })
  : null;
