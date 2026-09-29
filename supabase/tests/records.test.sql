\set ON_ERROR_STOP on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '== 1. перший запис приймається =='
select count(*) as accepted from public.push_records($$[
  {"table_name":"lessonObs","id":"obs-1","student_id":"s1","date":"2026-09-14","data":{"id":"obs-1","marks":["a"]},"updated_at":"2026-09-14T10:00:00.000Z","deleted_at":null}
]$$::jsonb);

do $$ declare n int; begin
  select count(*) into n from public.records where id = 'obs-1';
  if n <> 1 then raise exception 'рядок не записався'; end if;
end $$;

\echo '== 2. старіша версія не затирає новішу =='
select count(*) as accepted from public.push_records($$[
  {"table_name":"lessonObs","id":"obs-1","student_id":"s1","date":"2026-09-14","data":{"id":"obs-1","marks":["СТАРЕ"]},"updated_at":"2026-09-14T09:00:00.000Z","deleted_at":null}
]$$::jsonb);

do $$ declare d jsonb; begin
  select data into d from public.records where id = 'obs-1';
  if d->'marks'->>0 <> 'a' then raise exception 'стара версія затерла новішу: %', d; end if;
end $$;

\echo '== 3. новіша версія приймається і зсуває server_seq =='
select count(*) as accepted from public.push_records($$[
  {"table_name":"lessonObs","id":"obs-1","student_id":"s1","date":"2026-09-14","data":{"id":"obs-1","marks":["a","b"]},"updated_at":"2026-09-14T11:00:00.000Z","deleted_at":null}
]$$::jsonb);

do $$ declare d jsonb; s1 bigint; s2 bigint; begin
  select data, server_seq into d, s2 from public.records where id = 'obs-1';
  if jsonb_array_length(d->'marks') <> 2 then raise exception 'новіша версія не записалася: %', d; end if;
  select server_seq into s1 from public.records where id = 'obs-1';
  if s1 <= 1 then raise exception 'server_seq не зріс: %', s1; end if;
end $$;

\echo '== 4. час із майбутнього обрізається, оригінал зберігається =='
select count(*) as accepted from public.push_records($$[
  {"table_name":"lessons","id":"les-1","student_id":"s1","date":"2026-09-14","data":{"id":"les-1"},"updated_at":"2030-01-01T00:00:00.000Z","deleted_at":null}
]$$::jsonb);

do $$ declare u timestamptz; c timestamptz; begin
  select updated_at, client_updated_at into u, c from public.records where id = 'les-1';
  if u > now() + interval '1 minute' then raise exception 'час із майбутнього не обрізано: %', u; end if;
  if c <> '2030-01-01T00:00:00Z'::timestamptz then raise exception 'оригінальний час не збережено: %', c; end if;
end $$;

\echo '== 5. м''яке видалення поширюється, тверде заборонене =='
select count(*) as accepted from public.push_records($$[
  {"table_name":"lessonObs","id":"obs-1","student_id":"s1","date":"2026-09-14","data":{"id":"obs-1"},"updated_at":"2026-09-14T12:00:00.000Z","deleted_at":"2026-09-14T12:00:00.000Z"}
]$$::jsonb);

do $$ begin
  begin
    delete from public.records where id = 'obs-1';
    raise exception 'клієнт зміг видалити рядок назавжди';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo '== 6. чужі записи не видно й не перетинаються =='
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from public.records;
  if n <> 0 then raise exception 'користувач B бачить % чужих рядків', n; end if;
end $$;

select count(*) as accepted from public.push_records($$[
  {"table_name":"lessonObs","id":"obs-1","student_id":"s1","date":"2026-09-14","data":{"id":"obs-1","marks":["B"]},"updated_at":"2026-09-14T08:00:00.000Z","deleted_at":null}
]$$::jsonb);

do $$ declare d jsonb; begin
  select data into d from public.records where id = 'obs-1';
  if d->'marks'->>0 <> 'B' then raise exception 'однаковий id двох користувачів зіткнувся: %', d; end if;
end $$;

\echo '== 7. чужий owner_id підставити не можна =='
do $$ begin
  begin
    insert into public.records (owner_id, table_name, id, data, updated_at)
      values ('11111111-1111-1111-1111-111111111111', 'lessons', 'hack', '{}'::jsonb, now());
    raise exception 'вдалося записати рядок у чужий акаунт';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo '== 8. курсор: вибірка за server_seq =='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select table_name, id, server_seq, deleted_at is not null as deleted
from public.records where server_seq > 0 order by server_seq;

\echo 'УСІ ПЕРЕВІРКИ ПРОЙДЕНІ'
