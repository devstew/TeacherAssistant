import { Redirect } from 'expo-router';

/**
 * journal://auth — адреса повернення з Google. Код обмінює SyncProvider, а
 * сюди потрапляє сам застосунок, коли Android відкриває його за цим посиланням:
 * просто повертаємо людину до налаштувань синхронізації.
 */
export default function AuthReturn() {
  return <Redirect href="/settings" />;
}
