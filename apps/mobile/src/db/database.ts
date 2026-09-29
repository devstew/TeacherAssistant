/**
 * База застосунку — SQLite на самому телефоні. Журнал заповнюють на уроці,
 * де мережі може не бути взагалі, тож усе працює локально, а синхронізація
 * лише доносить зміни до інших пристроїв.
 */
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { SqliteDriver, Store, setEnv, setStore, type SqlConnection } from '@journal/core';

const FILE = 'journal.db';

function connection(db: SQLite.SQLiteDatabase): SqlConnection {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params) => {
      await db.runAsync(sql, [...(params ?? [])]);
    },
    all: <T,>(sql: string, params?: readonly (string | number | null)[]) => db.getAllAsync<T>(sql, [...(params ?? [])]),
    // Черга транзакцій живе в ядрі, тут потрібна лише атомарність запису.
    tx: async <T,>(fn: () => Promise<T>): Promise<T> => {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
  };
}

let opening: Promise<Store> | null = null;

/** Відкриває базу один раз за запуск і підключає її до ядра. */
export function openStore(): Promise<Store> {
  opening ??= (async () => {
    // У Hermes немає crypto.randomUUID — id видає системний генератор.
    setEnv({ newId: () => Crypto.randomUUID() });
    const db = await SQLite.openDatabaseAsync(FILE);
    await db.execAsync('pragma journal_mode = WAL;');
    const store = new Store(await SqliteDriver.create(connection(db)));
    setStore(store);
    return store;
  })();
  return opening;
}
