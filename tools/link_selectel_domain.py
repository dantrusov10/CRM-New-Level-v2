#!/usr/bin/env python3
import importlib.util
import json
import time
import urllib.parse

spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
sid = json.load(open("/opt/pb-control/.selectel_smtp_meta.json"))["resource_id"]
for i in range(8):
    if s.link_domain(tok, sid):
        break
    print("retry", i + 1)
    time.sleep(25)
q = urllib.parse.urlencode({"name": s.DOMAIN})
code, data = s.api("GET", f"{s.SES_BASE}/resources/{sid}/domains/check?{q}", tok)
print("check", code, json.dumps(data, ensure_ascii=False))
