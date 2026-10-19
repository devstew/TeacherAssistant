/**
 * Supabase повідомляє про помилки англійською й технічно. Асистент бачить
 * зрозумілу фразу: у школі нема кому розшифровувати «Failed to fetch».
 */
const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|fetch failed|network request failed/i, "немає зв'язку з сервером — перевірте інтернет"],
  [/expired|invalid token|otp|invalid or has expired/i, 'код неправильний або застарів — надішліть новий'],
  [/only request this after (\d+) second/i, 'новий код можна попросити через $1 с'],
  [/rate limit|too many requests/i, 'забагато спроб поспіль — спробуйте за кілька хвилин'],
  // Вхід через Google: вимкнений у Supabase, людина передумала, повернулася не в той браузер.
  [/unsupported provider|provider is not enabled/i, 'вхід через Google ще не ввімкнено в налаштуваннях проєкту Supabase'],
  [/access_denied|access denied|user denied/i, 'вхід через Google скасовано'],
  [/flow state|code verifier|both auth code and code verifier/i, 'вхід через Google не завершився — почніть його ще раз у тому самому браузері'],
  // Google відповів, але сервер не зміг цього прийняти: здебільшого Client ID чи
  // Secret у Supabase не збігаються з тими, що в Google Cloud.
  [
    /unable to exchange external code|error getting user .* from external provider|database error saving new user/i,
    'вхід через Google не вдався на сервері — це збій налаштувань, а не ваша помилка; поки що увійдіть кодом на пошту',
  ],
  [/signups not allowed|provider is disabled|email logins are disabled/i, 'вхід поштою вимкнено в налаштуваннях проєкту Supabase'],
  [/invalid email|unable to validate email/i, 'перевірте адресу пошти'],
  // Supabase не зміг віддати листа поштовій службі: у відповідь приходить
  // «Error sending magic link email» і код 500. Для асистента це глухий кут,
  // тож прямо кажемо, що це поломка на боці застосунку, а не її помилка.
  [
    /error sending.*(email|mail)|smtp/i,
    'не вдалося надіслати лист — це збій поштової служби, а не ваша помилка; спробуйте пізніше або зверніться до того, хто налаштовував застосунок',
  ],
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
