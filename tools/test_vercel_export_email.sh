#!/bin/bash
set -euo pipefail
EMAIL="${SERVICE_EMAIL:-crm-export@nwlvl.ru}"
PASS="${SERVICE_PASS:-CrmExport_Svc_2026!nwlvl}"
AUTH=$(curl -sS -X POST "https://pb.nwlvl.ru/api/collections/users/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOK=$(echo "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOK" ]; then echo "auth failed: $AUTH"; exit 1; fi
echo "PB auth ok"
OUT=$(curl -sS -w "\nHTTP_CODE:%{http_code}" -X POST "https://app.nwlvl.ru/api/send-export-email" \
  -H "Authorization: $TOK" \
  -H "Content-Type: application/json" \
  -d '{"to":"dantrusov10@yandex.ru","filename":"crm-vercel.txt","contentBase64":"dGVzdCB2ZXJjZWw="}')
echo "$OUT"
