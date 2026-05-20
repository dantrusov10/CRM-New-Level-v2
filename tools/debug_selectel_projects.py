#!/usr/bin/env python3
import importlib.util
import json
import sys
import urllib.request

spec = importlib.util.spec_from_file_location(
    "fetch", "/opt/pb-control/fetch_selectel_iam_token.py"
)
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)

c = fetch.load_creds()
body = {
    "auth": {
        "identity": {
            "methods": ["password"],
            "password": {"user": fetch.identity_user(c)},
        }
    }
}
code, token, err = fetch.keystone_post(body)
print("unscoped", code, bool(token), err[:200] if err else "")
if not token:
    sys.exit(1)
req = urllib.request.Request(
    "https://cloud.api.selcloud.ru/identity/v3/auth/projects",
    headers={"X-Auth-Token": token},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    data = json.loads(resp.read().decode())
for p in data.get("projects", []):
    print(p.get("id"), p.get("name"), p.get("enabled"))
