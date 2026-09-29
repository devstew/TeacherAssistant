-- Сховище журналу на сервері.
--
-- Одна таблиця на всі види записів: так само, як зберігає мобільний адаптер.
-- Менше коду й менше місць, де можна помилитися з доступом до даних дитини.

create extension if not exists pgcrypto;

create sequence if not exists public.records_seq;

create table if not exists public.records (
  owner_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  table_name  text        not null,
  id          text        not null,
  student_id  text,
  date        date,
  data        jsonb       not null,
  -- Годинник пристрою: лише для вирішення конфліктів («перемагає новіший»).
  updated_at  timestamptz not null,
  -- Що надіслав пристрій до обрізання — знадобиться, якщо доведеться розбиратися.
  client_updated_at timestamptz,
  deleted_at  timestamptz,
  -- Лічильник сервера: тільки за ним ідуть курсори завантаження.
  server_seq  bigint      not null default nextval('public.records_seq'),
  primary key (owner_id, table_name, id)
);

create index if not exists records_owner_seq on public.records (owner_id, server_seq);
create index if not exists records_owner_student on public.records (owner_id, student_id, date);

-- Кожен запис і кожна правка отримують новий номер у черзі сервера, а час із
-- майбутнього обрізається: телефон із неправильною датою інакше назавжди
-- вигравав би всі конфлікти.
create or replace function public.records_stamp() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.server_seq := nextval('public.records_seq');
  new.client_updated_at := new.updated_at;
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records
  for each row execute function public.records_stamp();

alter table public.records enable row level security;

drop policy if exists "власні записи" on public.records;
create policy "власні записи" on public.records for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Права рівно на те, що робить застосунок. Клієнт ніколи не видаляє рядки
-- назавжди: видалення м'які, інакше інші пристрої не дізнаються про них.
grant select, insert, update on public.records to authenticated;
revoke delete on public.records from authenticated;
-- Номер у черзі сервера присвоює тригер від імені користувача, тож йому
-- потрібен доступ до лічильника.
grant usage, select on sequence public.records_seq to authenticated;

/**
 * Запис пакета змін. Умова `where excluded.updated_at > records.updated_at`
 * головна: без неї повторна відправка старої офлайн-черги затерла б новіший
 * запис на сервері. Повертає рядки, які справді записалися.
 */
create or replace function public.push_records(rows jsonb)
returns table (table_name text, id text, updated_at timestamptz, server_seq bigint)
language sql security invoker set search_path = public, pg_temp as $$
  insert into public.records as r (table_name, id, student_id, date, data, updated_at, deleted_at)
  select
    x->>'table_name',
    x->>'id',
    nullif(x->>'student_id', ''),
    (nullif(x->>'date', ''))::date,
    x->'data',
    (x->>'updated_at')::timestamptz,
    (nullif(x->>'deleted_at', ''))::timestamptz
  from jsonb_array_elements(rows) as x
  on conflict (owner_id, table_name, id) do update
    set data = excluded.data,
        student_id = excluded.student_id,
        date = excluded.date,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where excluded.updated_at > r.updated_at
  returning r.table_name, r.id, r.updated_at, r.server_seq;
$$;
