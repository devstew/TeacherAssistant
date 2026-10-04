/**
 * Що саме вставив користувач у поле входу.
 *
 * Supabase дає редагувати шаблон листа лише тим, хто підключив власний SMTP,
 * а типовий шаблон містить посилання замість шестизначного коду. Тому
 * приймаємо обидва варіанти: і код, і посилання (чи просто довгий токен із
 * нього) — інакше увійти з типовими налаштуваннями проєкту було б неможливо.
 */
export type SignInInput =
  | { kind: 'code'; code: string }
  | { kind: 'link'; tokenHash: string };

/** Токен із листа — довгий шістнадцятковий рядок; код — кілька цифр. */
export function parseSignInInput(input: string): SignInInput | null {
  const text = input.trim();
  if (!text) return null;

  const fromUrl = /[?&]token=([a-zA-Z0-9_-]+)/.exec(text);
  if (fromUrl) return { kind: 'link', tokenHash: fromUrl[1] };

  const digits = text.replace(/\s+/g, '');
  if (/^\d{4,10}$/.test(digits)) return { kind: 'code', code: digits };

  if (/^[a-f0-9]{20,}$/i.test(digits)) return { kind: 'link', tokenHash: digits };

  return null;
}
