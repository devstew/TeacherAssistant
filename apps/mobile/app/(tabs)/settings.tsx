import { useState } from 'react';
import { Text, View } from 'react-native';
import { newStudent, saveStudent } from '@journal/core';
import { Button, Card, PageTitle, Select, Tabs } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';
import { SyncSection } from '@/features/SyncSection';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

type Tab = 'profile' | 'sync';

export default function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <Screen>
      <PageTitle title="Налаштування" />
      <Tabs
        tabs={[
          { id: 'profile', label: 'Дитина' },
          { id: 'sync', label: 'Синхронізація' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' ? <ProfileSection /> : <SyncSection />}
    </Screen>
  );
}

function ProfileSection() {
  const t = useTheme();
  const { student, students, setStudentId } = useStudents();

  return (
    <View style={{ gap: sp.lg }}>
      <Card title="Дитина">
        <View style={{ gap: sp.md }}>
          <Select
            label="Поточна дитина"
            value={student?.id}
            options={(students ?? []).map((s) => ({ id: s.id, label: s.className ? `${s.name} · ${s.className}` : s.name }))}
            onChange={setStudentId}
          />
          <Button
            onPress={async () => {
              const s = newStudent({ name: 'Нова дитина' });
              await saveStudent(s);
              setStudentId(s.id);
            }}
          >
            Додати дитину
          </Button>
        </View>
      </Card>

      <Card title="Профіль і показники">
        <Soon what="Редагування профілю, ваги пунктів бланку, пороги висновків і резервна копія." />
      </Card>

      <Card title="Про дані">
        <View style={{ gap: sp.sm }}>
          {[
            'Спостереження стосуються дитини з особливими освітніми потребами — це чутливі персональні дані.',
            'Журнал зберігається на самому телефоні; у хмару він потрапляє лише після вашого входу в акаунт.',
            'Видалення застосунку зітре журнал — тримайте свіжу резервну копію або увімкніть синхронізацію.',
            'Ведення журналу погоджуйте з батьками й адміністрацією школи.',
          ].map((line) => (
            <Text key={line} style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
              • {line}
            </Text>
          ))}
        </View>
      </Card>
    </View>
  );
}
