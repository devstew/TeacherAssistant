import type { Tbl } from '../store/tables';

/** Запис у тому вигляді, в якому він живе на сервері. */
export interface RemoteRecord {
  table: Tbl;
  id: string;
  studentId?: string;
  date?: string;
  data: Record<string, unknown>;
  /** Годинник пристрою: за ним вирішуються конфлікти. */
  updatedAt: string;
  deletedAt?: string;
  /** Лічильник сервера: за ним іде курсор завантаження. */
  serverSeq: number;
}

export type PushRow = Omit<RemoteRecord, 'serverSeq'>;

export interface PushResult {
  /** Рядки, які сервер прийняв. Решта — там уже є новіша версія. */
  accepted: { table: Tbl; id: string; updatedAt: string }[];
}

/**
 * Зв'язок із сервером. Ядро не знає ні про Supabase, ні про мережу —
 * це дозволяє проганяти синхронізацію в тестах на підробленому сервері.
 */
export interface SyncBackend {
  push(rows: PushRow[]): Promise<PushResult>;
  pull(cursor: number, limit: number): Promise<RemoteRecord[]>;
}

/** Запис, який не потрапив на сервер, бо там був новіший. */
export interface Conflict {
  table: Tbl;
  id: string;
  /** Час локальної версії, яку відхилили. */
  localUpdatedAt: string;
  /** Коли це сталося. */
  at: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  /** Коли востаннє успішно синхронізувалися. */
  lastSyncAt?: string;
  /** Скільки локальних змін ще не на сервері. */
  pending: number;
  /** Скільки записів програли конфлікт і чекають на перегляд. */
  conflicts: number;
  error?: string;
}
