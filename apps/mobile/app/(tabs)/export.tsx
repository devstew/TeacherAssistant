import { Card, PageTitle } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Soon } from '@/features/Soon';

export default function ExportScreen() {
  return (
    <Screen>
      <PageTitle title="Експорт" subtitle="Документи для школи — з того самого журналу." />
      <Card title="Документи">
        <Soon what="Бланк спостереження й звіт за період у PDF, таблиця XLSX і системне «Поділитися»." />
      </Card>
    </Screen>
  );
}
