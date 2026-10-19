/**
 * Вхід через Google. Google повертає людину на адресу застосунку з `?code=…`
 * (PKCE): код обмінюють на сесію тим самим клієнтом, що почав вхід, — бо лише
 * в його сховищі лежить перевірочний ключ. Помилку (людина передумала, вхід
 * вимкнено) Supabase кладе в `?error_description=…`, а часом — після `#`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyError } from './errors';

export type OAuthReturn = { kind: 'code'; code: string } | { kind: 'error'; message: string } | null;

export function parseOAuthReturn(url: string | undefined): OAuthReturn {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const query = u.searchParams;
  const code = query.get('code');
  if (code) return { kind: 'code', code };
  // У веб-версії після «#» живе маршрут («#/settings»), тож зважаємо на хеш, лише коли там помилка.
  const raw = u.hash.replace(/^#\/?/, '');
  const hash = /(^|&)error(_description)?=/.test(raw) ? new URLSearchParams(raw) : null;
  const error = query.get('error_description') ?? query.get('error') ?? hash?.get('error_description') ?? hash?.get('error');
  return error ? { kind: 'error', message: error } : null;
}

/** Адреса без слідів входу: що лишити в рядку браузера після обміну. */
export function withoutOAuthParams(url: string): string {
  const u = new URL(url);
  for (const k of ['code', 'error', 'error_code', 'error_description', 'state']) u.searchParams.delete(k);
  if (/(^|&)error(_description)?=/.test(u.hash.replace(/^#\/?/, ''))) u.hash = '';
  return u.toString();
}

// Один код обмінюють один раз — навіть якщо React двічі запустить ефект.
const exchanged = new Set<string>();

/** Обміняти код на сесію. Повертає зрозумілу помилку або нічого, якщо все гаразд. */
export async function finishOAuth(client: SupabaseClient, ret: OAuthReturn): Promise<string | undefined> {
  if (!ret) return;
  if (ret.kind === 'error') return friendlyError(ret.message);
  if (exchanged.has(ret.code)) return;
  exchanged.add(ret.code);
  try {
    const { error } = await client.auth.exchangeCodeForSession(ret.code);
    return error ? friendlyError(error.message) : undefined;
  } catch (e) {
    return friendlyError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Чи ввімкнено в проєкті Supabase вхід через цього провайдера. Публічні
 * налаштування авторизації — без входу, лише з публічним ключем. Поки Google
 * не налаштували, кнопки немає: інакше вона відкрила б сиру помилку Supabase.
 */
export async function providerEnabled(url: string, anonKey: string, provider: 'google', fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetcher(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!res.ok) return false;
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return body.external?.[provider] === true;
  } catch {
    return false;
  }
}
