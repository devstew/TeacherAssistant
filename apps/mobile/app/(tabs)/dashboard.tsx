import { Card, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';

export default function DashboardScreen() {
  return (
    <Screen>
      <PageTitle title="Дашборд" subtitle="Динаміка поведінки й навчання за місяцями." />
      <Card title="Показники">
        <Soon what="Індекси поведінки, навчання й самостійності, порівняння місяців, теплова карта пунктів і висновки." />
      </Card>
    </Screen>
  );
}
