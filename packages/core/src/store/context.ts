import type { Store } from './port';

let current: Store | null = null;

/** Застосунок підключає своє сховище один раз на старті. */
export function setStore(store: Store): void {
  current = store;
}

export function getStore(): Store {
  if (!current) throw new Error('Сховище не підключене: викличте setStore() на старті застосунку.');
  return current;
}
