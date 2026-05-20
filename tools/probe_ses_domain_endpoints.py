#!/usr/bin/env python3
import importlib.util
import json

SES_ID = "62d5d2e5-75b0-47cf-99c6-d5fae6e6960c"
spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
paths = [
    f"/resources/{SES_ID}/domains/nwlvl.ru",
    f"/resources/{SES_ID}/domain/nwlvl.ru",
    f"/resources/{SES_ID}/domains/nwlvl.ru/dkim",
    f"/resources/{SES_ID}/domains/nwlvl.ru/records",
]
for p in paths:
    c, d = s.api("GET", s.SES_BASE + p, tok)
    print(p, c, str(d)[:300])
