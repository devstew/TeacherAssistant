import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { openStore } from '@/db/database';
import { StudentProvider, useStudents } from '@/state/student';
import { SyncProvider } from '@/sync/SyncProvider';
import { Welcome } from '@/features/Welcome';
import { font, sp, useTheme } from '@/theme';

export default function RootLayout() {
  const t = useTheme();
  const [db, setDb] = useState<'loading' | 'ready' | string>('loading');

  useEffect(() => {
    openStore().then(
      () => setDb('ready'),
      (e: unknown) => setDb(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {db === 'loading' ? (
        <Center>
          <ActivityIndicator color={t.brand} />
        </Center>
      ) : db === 'ready' ? (
        <SyncProvider>
          <StudentProvider>
            <Gate />
          </StudentProvider>
        </SyncProvider>
      ) : (
        <Center>
          <Text style={{ color: t.text, fontSize: font.md, textAlign: 'center' }}>Не вдалося відкрити базу журналу.</Text>
          <Text style={{ color: t.muted, fontSize: font.sm, textAlign: 'center' }}>{db}</Text>
        </Center>
      )}
    </SafeAreaProvider>
  );
}

/** Без жодної дитини показувати розклад і бланк немає сенсу. */
function Gate() {
  const t = useTheme();
  const { students } = useStudents();
  if (students === undefined)
    return (
      <Center>
        <ActivityIndicator color={t.brand} />
      </Center>
    );
  return students.length ? <Slot /> : <Welcome />;
}

function Center({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: sp.md, padding: sp.xl, backgroundColor: t.bg }}>
      {children}
    </View>
  );
}
