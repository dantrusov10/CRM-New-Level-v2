#!/usr/bin/env python3
"""One-shot: PocketBase export_jobs + service user token (run on server or via ssh)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

PB = os.environ.get("PB_URL", "http://127.0.0.1:8090").rstrip("/")
ADMIN_EMAIL = os.environ["PB_ADMIN_EMAIL"]
ADMIN_PASS = os.environ["PB_ADMIN_PASSWORD"]
SERVICE_EMAIL = os.environ.get("SERVICE_USER_EMAIL", "crm-export@nwlvl.ru")
SERVICE_PASS = os.environ.get("SERVICE_USER_PASSWORD", "CrmExport_Svc_2026!nwlvl")


def http(method: str, path: str, body: dict | None, token: str | None = None):
    url = f"{PB}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return e.code, parsed


def main() -> int:
    code, auth = http(
        "POST",
        "/api/admins/auth-with-password",
        {"identity": ADMIN_EMAIL, "password": ADMIN_PASS},
        None,
    )
    if code != 200:
        print("admin auth failed", code, auth, file=sys.stderr)
        return 1
    admin_token = auth.get("token", "")
    print("admin ok")

    collection = {
        "id": "pbc_exportjob01",
        "name": "export_jobs",
        "type": "base",
        "schema": [
            {"name": "job_id", "type": "text", "required": True, "options": {"max": 64}},
            {"name": "name", "type": "text", "required": False, "options": {"max": 200}},
            {"name": "enabled", "type": "bool", "required": False},
            {
                "name": "owner_id",
                "type": "relation",
                "required": False,
                "options": {"collectionId": "_pb_users_auth_", "maxSelect": 1},
            },
            {"name": "config_json", "type": "json", "required": False, "options": {"maxSize": 2000000}},
            {"name": "last_run_key", "type": "text", "required": False, "options": {"max": 32}},
            {"name": "last_run_at", "type": "date", "required": False},
        ],
        "listRule": '@request.auth.id != "" && (owner_id = @request.auth.id || @request.auth.role = "admin")',
        "viewRule": '@request.auth.id != "" && (owner_id = @request.auth.id || @request.auth.role = "admin")',
        "createRule": '@request.auth.id != ""',
        "updateRule": '@request.auth.id != "" && (owner_id = @request.auth.id || @request.auth.role = "admin")',
        "deleteRule": '@request.auth.id != "" && (owner_id = @request.auth.id || @request.auth.role = "admin")',
    }

    code, existing = http("GET", "/api/collections/export_jobs", None, admin_token)
    if code == 200:
        print("export_jobs already exists")
    else:
        code, created = http("POST", "/api/collections", collection, admin_token)
        if code not in (200, 201):
            print("create collection failed", code, created, file=sys.stderr)
            return 1
        print("export_jobs created")

    # CRM service user (users collection)
    code, users = http(
        "GET",
        f'/api/collections/users/records?filter=email="{SERVICE_EMAIL}"&perPage=1',
        None,
        admin_token,
    )
    user_id = None
    if code == 200 and users.get("items"):
        user_id = users["items"][0]["id"]
        print("service user exists", user_id)
    else:
        code, rec = http(
            "POST",
            "/api/collections/users/records",
            {
                "email": SERVICE_EMAIL,
                "password": SERVICE_PASS,
                "passwordConfirm": SERVICE_PASS,
                "role": "admin",
                "name": "CRM Export Bot",
            },
            admin_token,
        )
        if code not in (200, 201):
            print("create service user failed", code, rec, file=sys.stderr)
            return 1
        user_id = rec.get("id")
        print("service user created", user_id)

    code, uauth = http(
        "POST",
        "/api/collections/users/auth-with-password",
        {"identity": SERVICE_EMAIL, "password": SERVICE_PASS},
        None,
    )
    if code != 200:
        print("user auth failed", code, uauth, file=sys.stderr)
        return 1
    token = uauth.get("token", "")
    print("SERVICE_TOKEN=" + token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
