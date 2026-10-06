/**
 * Пропозиція поставити журнал іконкою на головний екран.
 *
 * Асистент відкриває застосунок за надісланим посиланням і працює в ньому як у
 * звичайному сайті, не здогадуючись, що іконку можна поставити поруч із рештою
 * застосунків — а саме так журнал відкривається без адресного рядка й надійніше
 * працює без мережі.
 *
 * Chrome дає для цього подію `beforeinstallprompt` і системне вікно. Safari на
 * iPhone не дає нічого, тож там лишається показати, де шукати потрібний пункт у
 * меню «Поділитися».
 */
import { useCallback, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Що саме показувати користувачу. */
export type InstallKind =
  /** Застосунок уже стоїть окремо — пропонувати нічого не треба. */
  | 'installed'
  /** Браузер уміє встановити сам: достатньо кнопки. */
  | 'prompt'
  /** iPhone та iPad: системного вікна немає, показуємо кроки. */
  | 'ios'
  /** Браузер не вміє (Firefox на комп'ютері тощо) — мовчимо. */
  | 'none';

let deferred: BeforeInstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

function isStandalone(): boolean {
  // Safari на iOS не підтримує display-mode і має власний прапорець.
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ представляється як Macintosh — відрізняємо його за сенсорним екраном.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

if (typeof window !== 'undefined') {
  installed = isStandalone();
  window.addEventListener('beforeinstallprompt', (e) => {
    // Без preventDefault Chrome покаже власну смужку й більше не спитає.
    e.preventDefault();
    deferred = e as BeforeInstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function snapshot(): InstallKind {
  if (installed) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'none';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useInstallKind = (): InstallKind => useSyncExternalStore(subscribe, snapshot);

/** Відкриває системне вікно встановлення. Подію Chrome дає один раз. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

const SNOOZE_KEY = 'aj.installAsked';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function readSnooze(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Закрита смужка повертається через тиждень: іконка справді потрібна, але
 * питати про неї щодня — вірний спосіб привчити натискати «закрити» не читаючи.
 */
export function useSnooze(): [snoozed: boolean, snooze: () => void] {
  const [until, setUntil] = useState(readSnooze);
  const snooze = useCallback(() => {
    const next = Date.now() + SNOOZE_MS;
    setUntil(next);
    try {
      localStorage.setItem(SNOOZE_KEY, String(next));
    } catch {
      // сховище недоступне (приватний режим) — смужка сховається до перезавантаження
    }
  }, []);
  return [until > Date.now(), snooze];
}
