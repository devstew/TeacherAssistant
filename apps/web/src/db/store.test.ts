import 'fake-indexeddb/auto';
import { runStoreConformance } from '@journal/core/store/conformance';
import { JournalDB } from './db';
import { DexieDriver } from './dexieDriver';

// Той самий набір перевірок, що й для сховища в пам'яті — адаптери не мають розходитися.
runStoreConformance('IndexedDB', async () => {
  const database = new JournalDB(`conformance-${Math.random().toString(36).slice(2)}`);
  await database.open();
  return new DexieDriver(database);
});
