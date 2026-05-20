#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

CREDS = "/opt/pb-control/.selectel_service_creds"
KEYSTONE = "https://cloud.api.selcloud.ru/identity/v3/auth/tokens"
UID = "1fa81d87a1cb4dff9d446c6fe7f77ada"

def load():
    data = {}
    with open(CREDS, encoding="utf-8-sig") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                data[k.strip()] = v.strip()
    return data["SELECTEL_PASSWORD"]

def token():
    body = {"auth": {"identity": {"methods": ["password"], "password": {"user": {"id": UID, "password": load()}}}}}
    req = urllib.request.Request(KEYSTONE, data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.headers.get("X-Subject-Token")

def get(url, tok):
    req = urllib.request.Request(url, headers={"X-Auth-Token": tok})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()[:500]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

def main():
    t = token()
    print("token ok", t[:16] if t else None)
    for url in [
        "https://cloud.api.selcloud.ru/identity/v3/auth/projects",
        "https://api.selectel.ru/ses/v1/resources",
        "https://api.selectel.ru/domains/v2/zones",
        "https://api.selectel.ru/v2/projects",
    ]:
        print(url, get(url, t))

if __name__ == "__main__":
    main()
