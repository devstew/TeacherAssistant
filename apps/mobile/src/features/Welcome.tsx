import { useState } from 'react';
import { Text, View } from 'react-native';
import { newStudent, saveStudent, seedDemo } from '@journal/core';
import { Button, Card, Field, Input, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { SyncSection } from '@/features/settings/SyncSection';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

/** Перший запуск: без дитини журнал не має про кого вести записи. */
export function Welcome() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const { setStudentId } = useStudents();

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

      {/* Той самий демо-журнал, що й у налаштуваннях: подивитися застосунок
          на заповнених даних можна ще до створення справжнього профілю. */}
      <Card title="Або подивіться на прикладі">
        <View style={{ gap: sp.md }}>
          <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
            Два вигаданих профілі: дитина цього навчального року і торішній I семестр повністю. Це не справжні діти —
            їх можна видалити в налаштуваннях.
          </Text>
          <Button
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const { current } = await seedDemo();
              setStudentId(current.id);
              setBusy(false);
            }}
          >
            {busy ? 'Створюю…' : 'Відкрити демо'}
          </Button>
        </View>
      </Card>
      <Text style={{ color: t.muted, fontSize: font.xs }}>
        Дані зберігаються на цьому телефоні й нікуди не надсилаються, поки ви не увійдете в акаунт.
      </Text>
    </Screen>
  );
}
