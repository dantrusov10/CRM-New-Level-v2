#!/bin/bash
set -euo pipefail
TOK=$(cat /opt/pb-control/.crm_service_token)
curl -sS -X POST "https://control.nwlvl.ru/owner/api/public/send-export-email" \
  -H "Authorization: $TOK" \
  -H "Content-Type: application/json" \
  -d '{"to":"dantrusov10@yandex.ru","filename":"crm-final.txt","contentBase64":"dGVzdCBmaW5hbA==","tenant_pb_url":"https://pb.nwlvl.ru/api"}'
echo
