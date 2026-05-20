#!/usr/bin/env python3
"""Try to discover Selectel account ID from service user login/password."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

KEYSTONE = "https://cloud.api.selcloud.ru/identity/v3/auth/tokens"
CREDS = os.environ.get("SELECTEL_CREDS_FILE", "/opt/pb-control/.selectel_service_creds")


def load() -> tuple[str, str]:
    u = os.environ.get("SELECTEL_USER", "")
    p = os.environ.get("SELECTEL_PASSWORD", "")
    if os.path.isfile(CREDS):
        data = {}
        with open(CREDS, encoding="utf-8-sig") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.partition("=")
                    data[k.strip()] = v.strip()
        u = u or data.get("SELECTEL_USER", "")
        p = p or data.get("SELECTEL_PASSWORD", "")
    if not u or not p:
        sys.exit("need creds")
    return u, p


def try_domain(user: str, password: str, domain: str) -> bool:
    body = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {
                    "user": {
                        "name": user,
                        "domain": {"name": domain},
                        "password": password,
                    }
                },
            }
        }
    }
    req = urllib.request.Request(
        KEYSTONE,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return bool(resp.headers.get("X-Subject-Token"))
    except urllib.error.HTTPError:
        return False


def main() -> int:
    user, password = load()
    hint = os.environ.get("SELECTEL_ACCOUNT_ID", "").strip()
    candidates = []
    if hint:
        candidates.append(hint)
    # частые варианты + перебор 5–7 цифр по подсказке из uid не делаем
    for d in ("default", "Default", "selectel"):
        if d not in candidates:
            candidates.append(d)

    for domain in candidates:
        if try_domain(user, password, domain):
            print(domain)
            return 0

    print("Could not discover account id — set SELECTEL_ACCOUNT_ID in creds file", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
