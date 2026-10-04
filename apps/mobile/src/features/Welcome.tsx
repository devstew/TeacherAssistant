import { useState } from 'react';
import { Text, View } from 'react-native';
import { newStudent, saveStudent } from '@journal/core';
import { Button, Card, Field, Input, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { SyncSection } from '@/features/settings/SyncSection';
import { font, sp, useTheme } from '@/theme';

/** Перший запуск: без дитини журнал не має про кого вести записи. */
export function Welcome() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);

  // На новому телефоні журнал уже може лежати в акаунті — тоді створювати
  // дитину наново не треба, її принесе синхронізація.
  if (signIn)
    return (
      <Screen>
        <PageTitle title="Вхід в акаунт" subtitle="Журнал завантажиться з вашого облікового запису." />
        <SyncSection />
        <Button variant="ghost" onPress={() => setSignIn(false)}>
          Назад
        </Button>
      </Screen>
    );

  return (
    <Screen>
      <PageTitle title="Журнал асистента" subtitle="Розклад, щоденні спостереження й динаміка показників дитини." />
      <Card title="Створіть профіль дитини">
        <View style={{ gap: sp.md }}>
          <Field label="ПІБ або псевдонім дитини" hint="Можна використовувати ініціали — дані залишаються на цьому пристрої.">
            <Input value={name} onChangeText={setName} placeholder="Напр. Андрій К." autoCapitalize="words" />
          </Field>
          <Field label="Клас">
            <Input value={className} onChangeText={setClassName} placeholder="Напр. 3-Б" />
          </Field>
          <Field label="ПІБ асистента вчителя" hint="Для шапки експортованих документів.">
            <Input value={assistantName} onChangeText={setAssistantName} autoCapitalize="words" />
          </Field>
          <Button
            variant="primary"
            disabled={busy || !name.trim()}
            onPress={async () => {
              setBusy(true);
              await saveStudent(
                newStudent({ name: name.trim(), className: className.trim(), assistantName: assistantName.trim() }),
              );
              setBusy(false);
            }}
          >
            {busy ? 'Створюю…' : 'Почати'}
          </Button>
        </View>
      </Card>
      <Button variant="ghost" onPress={() => setSignIn(true)}>
        У мене вже є журнал в акаунті
      </Button>
      <Text style={{ color: t.muted, fontSize: font.xs }}>
        Дані зберігаються на цьому телефоні й нікуди не надсилаються, поки ви не увійдете в акаунт.
      </Text>
    </Screen>
  );
}
