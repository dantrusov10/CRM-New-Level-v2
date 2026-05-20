#!/usr/bin/env python3
"""Refresh .selectel_smtp_meta.json from SES API (login/password)."""
import importlib.util
import json
import os

SES_ID = os.environ.get("SELECTEL_SES_ID", "62d5d2e5-75b0-47cf-99c6-d5fae6e6960c")
META = "/opt/pb-control/.selectel_smtp_meta.json"

spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
code, data = s.api("GET", f"{s.SES_BASE}/resources/{SES_ID}", tok)
if code != 200:
    raise SystemExit(f"GET resource failed {code} {data}")
r = data.get("resource", data)
meta = {
    "smtp_host": "smtp.mail.selcloud.ru",
    "smtp_port_tls": 1127,
    "smtp_port_starttls": 1126,
    "smtp_login": r.get("login"),
    "smtp_password": r.get("password"),
    "mail_from": "NewLevel CRM <crm@nwlvl.ru>",
    "resource_id": r.get("id", SES_ID),
    "dns_key": r.get("dns_key"),
}
with open(META, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)
os.chmod(META, 0o600)
with open("/opt/pb-control/.smtp_app_password", "w", encoding="utf-8") as f:
    f.write(str(meta["smtp_password"]))
os.chmod("/opt/pb-control/.smtp_app_password", 0o600)
print("meta updated", meta["resource_id"], "login", meta["smtp_login"])
