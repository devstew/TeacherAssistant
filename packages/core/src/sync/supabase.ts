import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tbl } from '../store/tables';
import type { PushResult, PushRow, RemoteRecord, SyncBackend } from './types';

interface RecordRow {
  table_name: string;
  id: string;
  student_id: string | null;
  date: string | null;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  server_seq: number;
}

/** Postgres віддає час у своєму форматі — зводимо до одного вигляду з локальним. */
const iso = (value: string | null | undefined): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

/** Зв'язок із таблицею `records` у Supabase. */
export function supabaseBackend(client: SupabaseClient): SyncBackend {
  return {
    async push(rows: PushRow[]): Promise<PushResult> {
      const { data, error } = await client.rpc('push_records', {
        rows: rows.map((r) => ({
          table_name: r.table,
          id: r.id,
          student_id: r.studentId ?? null,
          date: r.date ?? null,
          data: r.data,
          updated_at: r.updatedAt,
          deleted_at: r.deletedAt ?? null,
        })),
      });
      if (error) throw new Error(`Не вдалося надіслати зміни: ${error.message}`);
      const accepted = (data as { table_name: string; id: string; updated_at: string }[] | null) ?? [];
      return {
        accepted: accepted.map((a) => ({
          table: a.table_name as Tbl,
          id: a.id,
          updatedAt: iso(a.updated_at)!,
        })),
      };
    },

    async pull(cursor: number, limit: number): Promise<RemoteRecord[]> {
      const { data, error } = await client
        .from('records')
        .select('*')
        .gt('server_seq', cursor)
        .order('server_seq', { ascending: true })
        .limit(limit);
      if (error) throw new Error(`Не вдалося отримати зміни: ${error.message}`);
      return ((data as RecordRow[] | null) ?? []).map((r) => ({
        table: r.table_name as Tbl,
        id: r.id,
        studentId: r.student_id ?? undefined,
        date: r.date ?? undefined,
        data: r.data,
        updatedAt: iso(r.updated_at)!,
        deletedAt: iso(r.deleted_at),
        serverSeq: Number(r.server_seq),
      }));
    },
  };
}
