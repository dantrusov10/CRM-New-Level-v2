#!/bin/bash
# Apply report schema on local CRM PocketBase instances (PB 0.22).
set -euo pipefail

MIGRATE_EMAIL="schema-migrate@nwlvl.local"
MIGRATE_PASS="$(openssl rand -hex 24)"
ENSURE_PY="/tmp/ensure_report_schema.py"

declare -a TARGETS=(
  "pb.nwlvl.ru|/opt/pocketbase|/opt/pb_data|http://127.0.0.1:8090"
  "admintest14|/opt/tenants/tenant-admintest14/pocketbase|/opt/tenants/tenant-admintest14/pb_data|http://127.0.0.1:8108"
  "admintest15|/opt/tenants/tenant-admintest15/pocketbase|/opt/tenants/tenant-admintest15/pb_data|http://127.0.0.1:8109"
)

echo "Using ensure script: $ENSURE_PY"
FAILED=0

for row in "${TARGETS[@]}"; do
  IFS='|' read -r name bin dir url <<<"$row"
  echo
  echo "======== $name ($url) ========"
  if [ ! -x "$bin" ] || [ ! -d "$dir" ]; then
    echo "SKIP: missing binary/dir"
    FAILED=1
    continue
  fi

  "$bin" admin delete "$MIGRATE_EMAIL" --dir "$dir" >/dev/null 2>&1 || true
  if ! "$bin" admin create "$MIGRATE_EMAIL" "$MIGRATE_PASS" --dir "$dir"; then
    echo "FAIL: admin create"
    FAILED=1
    continue
  fi

  set +e
  PB_URLS="$url" PB_ADMIN_EMAIL="$MIGRATE_EMAIL" PB_ADMIN_PASSWORD="$MIGRATE_PASS" python3 "$ENSURE_PY"
  rc=$?
  set -e

  has_loss=$(sqlite3 "$dir/data.db" "SELECT CASE WHEN (SELECT schema FROM _collections WHERE name='deals') LIKE '%loss_reason%' THEN 1 ELSE 0 END;")
  has_pilot=$(sqlite3 "$dir/data.db" "SELECT CASE WHEN (SELECT schema FROM _collections WHERE name='deals') LIKE '%pilot_checklist%' THEN 1 ELSE 0 END;")
  has_products=$(sqlite3 "$dir/data.db" "SELECT CASE WHEN (SELECT schema FROM _collections WHERE name='deals') LIKE '%product_ids%' THEN 1 ELSE 0 END;")
  has_sr=$(sqlite3 "$dir/data.db" "SELECT count(1) FROM _collections WHERE name='saved_reports';")
  echo "verify: loss_reason=$has_loss pilot_checklist=$has_pilot product_ids=$has_products saved_reports=$has_sr ensure_rc=$rc"

  "$bin" admin delete "$MIGRATE_EMAIL" --dir "$dir" >/dev/null 2>&1 || true

  if [ "$rc" -ne 0 ] || [ "$has_loss" != "1" ] || [ "$has_pilot" != "1" ] || [ "$has_sr" != "1" ]; then
    FAILED=1
  fi
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "ALL OK"
  exit 0
fi
echo "COMPLETED WITH ERRORS"
exit 1
