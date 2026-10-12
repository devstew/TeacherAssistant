# Складання застосунку

Збирає EAS — хмарний сервіс Expo; локальний Xcode чи Android Studio для цього не потрібні.
Усі команди виконуються з теки `apps/mobile`.

```bash
npm i -g eas-cli        # один раз
eas login               # обліковий запис Expo (безкоштовний)
eas init                # створює проєкт і дописує його id в app.json
```

## Android: найкоротший шлях потримати застосунок у руках

```bash
eas build --platform android --profile preview
```

На виході — `.apk`, який ставиться на телефон за посиланням із листа. Обліковий запис
Google Play для цього не потрібен; він потрібен лише для внутрішнього тестування
й публікації (`--profile production` дає `.aab` для Play Console).

## iOS

```bash
eas build --platform ios --profile preview      # збірка для симулятора, без платного акаунта
eas build --platform ios --profile production   # потребує Apple Developer Program ($99/рік)
eas submit --platform ios --latest              # у TestFlight
```

Перший запуск `eas build --platform ios` попросить Apple ID і сам створить сертифікати
та профіль. Без платного акаунта iOS-збірка ставиться лише на симулятор.

## Локальний запуск без збірки

```bash
npm run mobile          # Expo Go: QR для телефона, i / a для симуляторів
```

## Змінні збірки

Локально ключі Supabase беруться з `.env.local` (див. `.env.example`). Цього файлу
немає в репозиторії, тож хмарна збірка його не бачить — для неї ключі зберігаються
окремо, в оточеннях EAS:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://… \
  --environment preview --environment production --visibility plaintext --scope project
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … \
  --environment preview --environment production --visibility plaintext --scope project
eas env:list preview        # перевірити, що обидві на місці
```

Профіль `preview` в `eas.json` не оголошує поле `environment`, але змінні оточення
`preview` до збірки все одно потрапляють — перевірено на APK збірки
`6ed3d9bb`: адреса проєкту й анонімний ключ лежать у `assets/index.android.bundle`.
Якщо ключів не додати, застосунок збереться й працюватиме, але вкладка синхронізації
скаже, що вона вимкнена.

Сюди йде лише анонімний ключ: він розрахований на те, щоб лежати в застосунку,
а доступ до чужих даних закриває RLS на сервері.

## Перед публікацією

- `supabase/migrations/0001_records.sql` виконано в проєкті Supabase, вхід поштою увімкнено;
- у картці застосунку вказано політику приватності (див. `PRIVACY.md`);
- у Play Console заповнено розділ «Безпека даних»: застосунок збирає освітні дані
  дитини, передає їх лише у власний обліковий запис користувача, дані шифруються
  в передачі, користувач може їх видалити.
