/**
 * SQLite проганяє той самий набір перевірок, що Dexie у вебі. З'єднання тут —
 * вбудований у Node `node:sqlite`, але SQL і драйвер ті самі, що на телефоні.
 */
import { DatabaseSync } from 'node:sqlite';
import { runStoreConformance } from './conformance';
import { SqliteDriver, type SqlConnection, type SqlValue } from './sqlite';

function nodeConnection(): SqlConnection {
  const db = new DatabaseSync(':memory:');
  const args = (params?: readonly SqlValue[]) => (params ?? []).map((v) => (v === undefined ? null : v));
  return {
    exec: async (sql) => db.exec(sql),
    run: async (sql, params) => void db.prepare(sql).run(...args(params)),
    all: async <T,>(sql: string, params?: readonly SqlValue[]) => db.prepare(sql).all(...args(params)) as T[],
    tx: async (fn) => {
      db.exec('begin');
      try {
        const result = await fn();
        db.exec('commit');
        return result;
      } catch (e) {
        db.exec('rollback');
        throw e;
      }
    },
  };
}

runStoreConformance('SQLite', async () => SqliteDriver.create(nodeConnection()));
