#!/usr/bin/env bash
# Перевірка міграції на справжньому Postgres: правила доступу до даних дитини
# не можна тримати на здогадках. Потрібен лише Docker.
#
#   supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"

NAME=journal-sql-test
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=journal postgres:17-alpine >/dev/null
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

run() { docker exec -i "$NAME" psql -q -v ON_ERROR_STOP=1 -U postgres -d journal < "$1"; }

run stubs.sql >/dev/null            # те, що Supabase дає готовим: auth.uid(), роль authenticated
run ../migrations/0001_records.sql >/dev/null
run records.test.sql
