import { View } from 'react-native';
import { fmtDate, getLessonsForRange, todayISO, useRepo } from '@journal/core';
import { Badge, Card, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';
import { useStudents } from '@/state/student';
import { sp } from '@/theme';

export default function TodayScreen() {
  const { student } = useStudents();
  const today = todayISO();
  const lessons = useRepo(getLessonsForRange, student!, today, today);

  return (
    <Screen>
      <PageTitle
        title="Сьогодні"
        subtitle={`${fmtDate(today, 'EEEE, d MMMM')} · ${student?.name ?? ''}`}
        actions={lessons && <Badge tone={lessons.length ? 'info' : 'neutral'}>уроків: {lessons.length}</Badge>}
      />
      <Card title="Уроки дня">
        <View style={{ gap: sp.sm }}>
          <Soon
            what="Список уроків із розкладу, позначка «н», перехід до бланку спостереження й підсумок дня."
            hint={lessons?.length ? undefined : 'Спершу заповніть розклад — уроки з’являться тут автоматично.'}
          />
        </View>
      </Card>
    </Screen>
  );
}
