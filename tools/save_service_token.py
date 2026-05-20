#!/usr/bin/env python3
import json
import os
import urllib.request

PB = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
email = os.environ["SERVICE_EMAIL"]
password = os.environ["SERVICE_PASSWORD"]
out = os.environ.get("OUT", "/opt/pb-control/.crm_service_token")

body = json.dumps({"identity": email, "password": password}).encode()
req = urllib.request.Request(
    f"{PB}/api/collections/users/auth-with-password",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req) as r:
    token = json.load(r)["token"]
with open(out, "w", encoding="utf-8") as f:
    f.write(token)
print("ok", len(token))
