import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { DEMO_IDS, deleteStudent, newStudent, removeDemo, saveStudent, seedDemo } from '@journal/core';
import { Button, Card, PageTitle, Select, Tabs } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { BackupSection } from './BackupSection';
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

/** Демо вмикається лише в збірці для розробки: EXPO_PUBLIC_ENABLE_DEMO=1. */
const DEMO_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO === '1';

function DataSection() {
  const t = useTheme();
  const { students, setStudentId } = useStudents();
  const [busy, setBusy] = useState(false);
  const hasDemo = students?.some((s) => DEMO_IDS.includes(s.id));

  return (
    <View style={{ gap: sp.lg }}>
      <BackupSection />

      {(DEMO_ENABLED || hasDemo) && (
        <Card title="Демо-дані">
          <View style={{ gap: sp.md }}>
            <Text style={{ color: t.subtle, fontSize: font.sm, lineHeight: 20 }}>
              Два профілі: поточний навчальний рік і торішня історія вересень–листопад — щоб подивитися дашборд і
              порівняння місяців.
            </Text>
            {DEMO_ENABLED && (
              <Button
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  const { current } = await seedDemo();
                  setStudentId(current.id);
                  setBusy(false);
                }}
              >
                {hasDemo ? 'Перестворити демо' : 'Завантажити демо'}
              </Button>
            )}
            {hasDemo && (
              <Button
                variant="danger"
                onPress={async () => {
                  const other = students?.find((s) => !DEMO_IDS.includes(s.id));
                  await removeDemo();
                  if (other) setStudentId(other.id);
                }}
              >
                Видалити демо
              </Button>
            )}
          </View>
        </Card>
      )}

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
