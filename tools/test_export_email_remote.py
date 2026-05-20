#!/usr/bin/env python3
import json
import os
import urllib.request

PB = os.environ.get("PB_URL", "http://127.0.0.1:8090")
EMAIL = os.environ["TEST_EMAIL"]
PASSWORD = os.environ["TEST_PASSWORD"]
TO = os.environ.get("MAIL_TO", EMAIL)
GATEWAY = os.environ.get("GATEWAY", "https://control.nwlvl.ru/owner/api/public/send-export-email")


def post(url, body, token=None):
    data = json.dumps(body).encode()
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = token
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


code, auth_raw = post(
    f"{PB}/api/collections/users/auth-with-password",
    {"identity": EMAIL, "password": PASSWORD},
)
auth = json.loads(auth_raw)
token = auth["token"]
print("auth", code)

code, resp = post(
    GATEWAY,
    {
        "to": TO,
        "filename": "crm-test.txt",
        "contentBase64": "dGVzdCBDUk0gYXV0b2V4cG9ydA==",
        "tenant_pb_url": "https://pb.nwlvl.ru/api",
    },
    token,
)
print("send", code, resp)
