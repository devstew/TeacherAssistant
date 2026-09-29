/**
 * Supabase повідомляє про помилки англійською й технічно. Асистент бачить
 * зрозумілу фразу: у школі нема кому розшифровувати «Failed to fetch».
 */
const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|fetch failed|network request failed/i, "немає зв'язку з сервером — перевірте інтернет"],
  [/expired|invalid token|otp|invalid or has expired/i, 'код неправильний або застарів — надішліть новий'],
  [/only request this after (\d+) second/i, 'новий код можна попросити через $1 с'],
  [/rate limit|too many requests/i, 'забагато спроб поспіль — спробуйте за кілька хвилин'],
  [/signups not allowed|provider is disabled|email logins are disabled/i, 'вхід поштою вимкнено в налаштуваннях проєкту Supabase'],
  [/invalid email|unable to validate email/i, 'перевірте адресу пошти'],
];

export function friendlyError(raw: string): string {
  for (const [re, phrase] of RULES) {
    const m = raw.match(re);
    if (m) {
      const text = phrase.replace('$1', m[1] ?? '');
      return text[0].toUpperCase() + text.slice(1) + '.';
    }
  }
  return raw;
}
