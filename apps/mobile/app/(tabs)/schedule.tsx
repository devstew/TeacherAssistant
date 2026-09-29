import { Card, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';

export default function ScheduleScreen() {
  return (
    <Screen>
      <PageTitle title="Розклад" subtitle="Сітка уроків, дзвінки, канікули та вихідні." />
      <Card title="Тижнева сітка">
        <Soon what="Предмети по днях і уроках, дзвінки, канікули й імпорт розкладу з файлу Human." />
      </Card>
    </Screen>
  );
}
