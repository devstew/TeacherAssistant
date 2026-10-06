import { useState } from 'react';
import { Share, Smartphone, SquarePlus, X } from 'lucide-react';
import { Button, Card, Notice } from '../components/ui';
import { promptInstall, useInstallKind, useSnooze } from './install';

const WHY = 'Це той самий журнал, лише з іконкою: відкривається без адресного рядка, працює без інтернету й не губиться серед вкладок.';

/**
 * Кроки для iPhone. Окремо попереджаємо про сховище: застосунок на головному
 * екрані отримує від iOS власну базу, тож записи, зроблені до цього в Safari,
 * у ньому не з'являться — краще поставити іконку відразу, ніж переносити потім.
 */
function IosSteps() {
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
        <li>
          Унизу натисніть <b>«Поділитися»</b>{' '}
          <Share size={14} className="inline align-text-bottom" aria-hidden /> — квадрат зі стрілкою вгору.
        </li>
        <li>
          Прокрутіть список і виберіть <b>«На екран «Додому»»</b>{' '}
          <SquarePlus size={14} className="inline align-text-bottom" aria-hidden />.
        </li>
        <li>
          Натисніть <b>«Додати»</b> — іконка з'явиться поруч з іншими застосунками.
        </li>
      </ol>
      <Notice tone="warn">
        Застосунок на головному екрані iPhone має власне сховище: записи, зроблені до цього в Safari, у ньому не
        відкриються. Якщо ви вже працювали тут — спершу увімкніть синхронізацію або збережіть резервну копію.
      </Notice>
    </div>
  );
}

function InstallButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="primary"
      size={size}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await promptInstall();
        } finally {
          setBusy(false);
        }
      }}
    >
      Встановити
    </Button>
  );
}

/** Картка для екрана привітання й налаштувань: місця вистачає, тож пояснюємо повністю. */
export function InstallCard() {
  const kind = useInstallKind();
  if (kind === 'installed' || kind === 'none') return null;
  return (
    <Card title="Поставте журнал на головний екран">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{WHY}</p>
      {kind === 'prompt' ? <InstallButton /> : <IosSteps />}
    </Card>
  );
}

/**
 * Смужка над вмістом для тих, хто вже працює в браузері. Закривається на тиждень:
 * без цього єдиним нагадуванням лишається екран привітання, який більше не з'явиться.
 */
export function InstallBanner() {
  const kind = useInstallKind();
  const [snoozed, snooze] = useSnooze();
  const [open, setOpen] = useState(false);

  if (snoozed || kind === 'installed' || kind === 'none') return null;

  return (
    <div className="mb-4 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:ring-brand-800">
      {/* На телефоні текст і кнопка не вміщаються в один рядок, тож кнопка йде під текстом. */}
      <div className="flex items-start gap-2">
        <Smartphone size={18} className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-200" aria-hidden />
        <div className="flex-1">
          <p className="text-sm text-brand-900 dark:text-brand-100">
            Журнал можна поставити іконкою на головний екран — працюватиме як звичайний застосунок.
          </p>
          <div className="mt-2">
            {kind === 'prompt' ? (
              <InstallButton size="sm" />
            ) : (
              <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? 'Згорнути' : 'Як це зробити'}
              </Button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={snooze}
          aria-label="Нагадати пізніше"
          className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-brand-800 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/60"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {open && kind === 'ios' && <div className="mt-3"><IosSteps /></div>}
    </div>
  );
}
