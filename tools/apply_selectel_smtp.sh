#!/bin/bash
# Apply Selectel SMTP credentials to platform-console (run on VPS as root).
set -euo pipefail

META="/opt/pb-control/.selectel_smtp_meta.json"
PASS_FILE="/opt/pb-control/.smtp_app_password"
DROPIN="/etc/systemd/system/platform-console.service.d/export-mail.conf"

if [[ ! -f "$META" ]]; then
  echo "Missing $META — run: python3 /opt/pb-control/setup_selectel_email.py" >&2
  exit 1
fi

LOGIN=$(python3 -c "import json; print(json.load(open('$META'))['smtp_login'])")
PASS=$(python3 -c "import json; print(json.load(open('$META'))['smtp_password'])")
MAIL_FROM=$(python3 -c "import json; print(json.load(open('$META'))['mail_from'])")

printf '%s' "$PASS" > "$PASS_FILE"
chmod 600 "$PASS_FILE"

cat > "$DROPIN" <<EOF
[Service]
Environment="MAIL_FROM=${MAIL_FROM}"
Environment=SMTP_HOST=smtp.mail.selcloud.ru
Environment=SMTP_PORT=1127
Environment=SMTP_USER=${LOGIN}
Environment=SMTP_SECURE=true
Environment=SMTP_PASS_FILE=/opt/pb-control/.smtp_app_password
Environment=DEFAULT_TENANT_PB_URL=https://pb.nwlvl.ru/api
EOF

systemctl daemon-reload
systemctl restart platform-console.service
echo "OK: Selectel SMTP applied, platform-console restarted"
echo "MAIL_FROM=${MAIL_FROM}"
echo "SMTP_USER=${LOGIN}"
