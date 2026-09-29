import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { deleteStudent, newStudent, saveStudent } from '@journal/core';
import { Button, Card, PageTitle, Select, Tabs } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';
import { ScoringSection } from './ScoringSection';
import { StudentForm } from './StudentForm';
import { SyncSection } from './SyncSection';
import { useStudents } from '@/state/student';
import { font, sp, useTheme } from '@/theme';

type Tab = 'profile' | 'scoring' | 'data' | 'sync';

export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <Screen>
      <PageTitle title="Налаштування" />
      <Tabs
        tabs={[
          { id: 'profile', label: 'Дитина' },
          { id: 'scoring', label: 'Показники' },
          { id: 'data', label: 'Дані' },
          { id: 'sync', label: 'Синхронізація' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' && <ProfileSection />}
      {tab === 'scoring' && <ScoringSection />}
      {tab === 'data' && <DataSection />}
      {tab === 'sync' && <SyncSection />}
    </Screen>
  );
}

function ProfileSection() {
  const { student, students, setStudentId } = useStudents();
  if (!student) return null;

  return (
    <View style={{ gap: sp.lg }}>
      <Card title="Профіль">
        <StudentForm key={student.id} initial={student} onSave={saveStudent} />
      </Card>

      <Card title="Діти">
        <View style={{ gap: sp.md }}>
          <Select
            label="Поточна дитина"
            value={student.id}
            options={(students ?? []).map((s) => ({
              id: s.id,
              label: s.className ? `${s.name} · ${s.className}` : s.name,
            }))}
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
          <Button
            variant="danger"
            onPress={() =>
              Alert.alert(
                `Видалити «${student.name}»?`,
                'Профіль і всі спостереження буде видалено. Дію не можна скасувати.',
                [
                  { text: 'Скасувати', style: 'cancel' },
                  {
                    text: 'Видалити',
                    style: 'destructive',
                    onPress: async () => {
                      const other = students?.find((s) => s.id !== student.id);
                      await deleteStudent(student.id);
                      if (other) setStudentId(other.id);
                    },
                  },
                ],
              )
            }
          >
            Видалити профіль
          </Button>
        </View>
      </Card>
    </View>
  );
}

function DataSection() {
  const t = useTheme();
  return (
    <View style={{ gap: sp.lg }}>
      <Card title="Резервна копія">
        <Soon what="Збереження журналу у файл JSON і відновлення з нього через системне «Поділитися»." />
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
