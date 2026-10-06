import { useState } from 'react';
import { useNavigate } from 'react-router';
import { newStudent, saveStudent } from '@journal/core';
import { DEMO_ENABLED, seedDemo } from '../../dev/seed';
import { useStudents } from '../../state/student';
import { Button, Card } from '../../components/ui';
import { InstallCard } from '../../pwa/InstallPrompt';
import { StudentForm } from './StudentForm';
import { SyncTab } from './SyncTab';

export default function Welcome() {
  const { setStudentId } = useStudents();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div className="flex items-center gap-3">
        <img src="./icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Журнал спостережень асистента вчителя</h1>
          <p className="text-sm text-slate-500">Розклад, щоденні спостереження, експорт бланку й динаміка показників дитини.</p>
        </div>
      </div>

      <Card title="Створіть профіль дитини">
        <StudentForm
          compact
          initial={newStudent()}
          submitLabel="Почати"
          onSave={async (s) => {
            await saveStudent(s);
            setStudentId(s.id);
            navigate('/schedule');
          }}
        />
      </Card>

      <InstallCard />

      {/* На новому пристрої журнал може вже лежати в акаунті — тоді дитину
          створювати не треба, її принесе синхронізація. */}
      {signIn ? (
        <>
          <SyncTab />
          <Button variant="ghost" onClick={() => setSignIn(false)}>
            Назад
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setSignIn(true)}>
          У мене вже є журнал в акаунті
        </Button>
      )}

      {DEMO_ENABLED && (
      <Card title="Або подивіться на прикладі">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Два вигаданих профілі: дитина цього навчального року (уроки до сьогодні, останній день заповнений частково)
          і торішня історія вересень–листопад із покращенням у листопаді. Їх можна видалити в налаштуваннях.
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { current } = await seedDemo();
            setStudentId(current.id);
            navigate('/dashboard');
          }}
        >
          {busy ? 'Створюю…' : 'Відкрити демо'}
        </Button>
      </Card>
      )}

      <p className="text-xs text-slate-500">
        Дані зберігаються в цьому браузері (IndexedDB) і нікуди не надсилаються, поки ви не увійдете в акаунт у
        налаштуваннях. Для перенесення на інший пристрій — синхронізація або резервна копія в налаштуваннях.
      </p>
    </div>
  );
}
