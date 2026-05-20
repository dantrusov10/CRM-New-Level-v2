#!/bin/bash
# Finalize Selectel mail for CRM (run on VPS as root).
set -euo pipefail
cd /opt/pb-control

SES_ID="${SELECTEL_SES_ID:-62d5d2e5-75b0-47cf-99c6-d5fae6e6960c}"

python3 fetch_selectel_iam_token.py
SELECTEL_SES_ID="$SES_ID" python3 sync_selectel_meta_from_api.py

python3 fix_selectel_verify_txt.py 2>/dev/null || true
python3 link_selectel_domain.py || true
bash apply_selectel_smtp.sh

echo "SMTP test:"
python3 test_smtp_direct.py "${TEST_MAIL_TO:-dantrusov10@yandex.ru}"

echo "Verification:"
python3 link_selectel_domain.py 2>&1 | tail -1
