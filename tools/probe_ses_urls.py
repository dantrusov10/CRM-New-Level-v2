#!/usr/bin/env python3
import urllib.request
tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
urls = [
    "https://api.selectel.ru/ses/v1/resources",
    "https://api.selectel.ru/ses/v1/resources/",
    "https://api.selectel.ru/v1/ses/resources",
    "https://api.selectel.ru/email-service/v1/resources",
    "https://api.selectel.ru/ses/resources",
]
for u in urls:
    req = urllib.request.Request(u, headers={"X-Auth-Token": tok})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(u, r.status, r.read()[:120])
    except Exception as e:
        print(u, getattr(e, "code", type(e).__name__), str(e)[:80])
