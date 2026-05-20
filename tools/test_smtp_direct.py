#!/usr/bin/env python3
import importlib.util
import json
import os
import sys

meta_path = "/opt/pb-control/.selectel_smtp_meta.json"
if os.path.isfile(meta_path):
    m = json.load(open(meta_path, encoding="utf-8"))
    os.environ.setdefault("SMTP_HOST", m.get("smtp_host", "smtp.mail.selcloud.ru"))
    os.environ.setdefault("SMTP_PORT", str(m.get("smtp_port_tls", 1127)))
    os.environ.setdefault("SMTP_USER", str(m.get("smtp_login", "")))
    os.environ.setdefault("SMTP_PASS", str(m.get("smtp_password", "")))
    os.environ.setdefault("MAIL_FROM", m.get("mail_from", "NewLevel CRM <crm@nwlvl.ru>"))
    os.environ.setdefault("SMTP_SECURE", "true")

paths = ["/opt/pb-control/platform-console/export_email.py"]
for p in paths:
    if os.path.isfile(p):
        spec = importlib.util.spec_from_file_location("em", p)
        em = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(em)
        to = sys.argv[1] if len(sys.argv) > 1 else "dantrusov10@yandex.ru"
        r = em.send_export_email(
            {
                "to": to,
                "filename": "crm-smtp-test.txt",
                "contentBase64": "dGVzdCBDUk0gU0VTEQ==",
            }
        )
        print(r)
        sys.exit(0 if r.get("ok") else 1)
print("export_email not found", file=sys.stderr)
sys.exit(1)
