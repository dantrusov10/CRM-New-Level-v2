#!/bin/bash
# Run on server as root after creating Yandex app password (Mail):
#   bash /opt/pb-control/set_smtp_app_password.sh
set -euo pipefail
read -r -s -p "Yandex app password for SMTP: " PASS
echo
install -m 600 /dev/null /opt/pb-control/.smtp_app_password
printf '%s' "$PASS" > /opt/pb-control/.smtp_app_password
systemctl restart platform-console.service
echo "OK: SMTP password saved, platform-console restarted"
