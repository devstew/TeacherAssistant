import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { finishOAuth, parseOAuthReturn, providerEnabled, withoutOAuthParams } from './oauth';
import { friendlyError } from './errors';

describe('повернення з Google', () => {
  it('код у query — і веб, і журнал://auth на телефоні', () => {
    expect(parseOAuthReturn('https://journal.app/?code=abc123#/settings')).toEqual({ kind: 'code', code: 'abc123' });
    expect(parseOAuthReturn('journal://auth?code=xyz')).toEqual({ kind: 'code', code: 'xyz' });
  });

  it('помилка — з query чи з хеша; маршрут у хеші помилкою не є', () => {
    expect(parseOAuthReturn('https://journal.app/?error=access_denied&error_description=The+user+denied')).toEqual({
      kind: 'error',
      message: 'The user denied',
    });
    expect(parseOAuthReturn('https://journal.app/#error=server_error&error_description=Unsupported+provider')).toEqual({
      kind: 'error',
      message: 'Unsupported provider',
    });
    expect(parseOAuthReturn('https://journal.app/#/settings')).toBeNull();
    expect(parseOAuthReturn(undefined)).toBeNull();
  });

  it('після обміну адреса чиста, маршрут лишається', () => {
    expect(withoutOAuthParams('https://journal.app/?code=abc#/settings')).toBe('https://journal.app/#/settings');
    expect(withoutOAuthParams('https://journal.app/#error=x&error_description=y')).toBe('https://journal.app/');
  });

  it('зрозумілі помилки для асистента', () => {
    expect(friendlyError('Unsupported provider: provider is not enabled')).toBe('Вхід через Google ще не ввімкнено в налаштуваннях проєкту Supabase.');
    expect(friendlyError('invalid flow state, no valid flow state found')).toContain('почніть його ще раз');
    expect(friendlyError('access_denied')).toBe('Вхід через Google скасовано.');
    expect(friendlyError('Unable to exchange external code: 4/0AVG…')).toMatch(/^Вхід через Google не вдався на сервері/);
  });

  it('один код обмінюють один раз', async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { exchangeCodeForSession: exchange } } as unknown as SupabaseClient;
    expect(await finishOAuth(client, { kind: 'code', code: 'once' })).toBeUndefined();
    await finishOAuth(client, { kind: 'code', code: 'once' });
    expect(exchange).toHaveBeenCalledTimes(1);
  });
});

describe('чи показувати кнопку Google', () => {
  const answer = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
  it('лише коли Supabase каже, що Google увімкнено', async () => {
    expect(await providerEnabled('https://x.supabase.co/', 'anon', 'google', answer({ external: { google: true } }))).toBe(true);
    expect(await providerEnabled('https://x.supabase.co', 'anon', 'google', answer({ external: { google: false } }))).toBe(false);
    expect(await providerEnabled('https://x.supabase.co', 'anon', 'google', answer({}, false))).toBe(false);
    const offline = vi.fn().mockRejectedValue(new Error('Failed to fetch')) as unknown as typeof fetch;
    expect(await providerEnabled('https://x.supabase.co', 'anon', 'google', offline)).toBe(false);
  });
});
