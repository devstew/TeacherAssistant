/**
 * Дрібниці, що залежать від платформи: генератор id і годинник. Ядро не має
 * звертатися до них напряму — у React Native (Hermes) немає `crypto.randomUUID`,
 * а тестам потрібен передбачуваний час.
 */
export interface Env {
  newId(): string;
  now(): string;
}

function randomUuid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let env: Env = {
  newId: randomUuid,
  now: () => new Date().toISOString(),
};

/** Підміняє реалізації (мобільний застосунок, тести). */
export function setEnv(next: Partial<Env>): void {
  env = { ...env, ...next };
}

export const newId = (): string => env.newId();

/** Час останньої зміни запису, ISO. Один годинник для всього застосунку. */
export const now = (): string => env.now();
