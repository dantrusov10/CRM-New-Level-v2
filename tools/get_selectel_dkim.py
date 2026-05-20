#!/usr/bin/env python3
"""Try to fetch DKIM / domain info from Selectel SES API."""
import importlib.util
import json
import urllib.parse

SES_ID = "62d5d2e5-75b0-47cf-99c6-d5fae6e6960c"
DOMAIN = "nwlvl.ru"

spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
for path in [
    f"/resources/{SES_ID}",
    f"/resources/{SES_ID}/domains",
    f"/resources/{SES_ID}/domains/check?name={DOMAIN}",
]:
    code, data = s.api("GET", s.SES_BASE + path.split("?")[0] + ("?" + path.split("?", 1)[1] if "?" in path else ""), tok)
    print("===", path, code)
    print(json.dumps(data, ensure_ascii=False, indent=2)[:2000])
