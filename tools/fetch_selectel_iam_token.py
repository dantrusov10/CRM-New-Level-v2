#!/usr/bin/env python3
"""Issue Selectel IAM project token (24h) and save to .selectel_iam_token.

Create /opt/pb-control/.selectel_service_creds (chmod 600):

  SELECTEL_USER=service_user_name
  SELECTEL_USER_ID=uuid_from_panel
  SELECTEL_PASSWORD=your_password_here
  SELECTEL_ACCOUNT_ID=123456
  SELECTEL_PROJECT_NAME=My Project

Account ID: опционально, если есть UID пользователя — достаточно SELECTEL_USER_ID.
Project name: опционально — скрипт подберёт проект через Keystone.

Then: python3 fetch_selectel_iam_token.py && python3 setup_selectel_email.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

CREDS_FILE = os.environ.get(
    "SELECTEL_CREDS_FILE", "/opt/pb-control/.selectel_service_creds"
)
TOKEN_FILE = os.environ.get(
    "SELECTEL_IAM_TOKEN_FILE", "/opt/pb-control/.selectel_iam_token"
)
KEYSTONE = "https://cloud.api.selcloud.ru/identity/v3/auth/tokens"


def load_creds() -> dict[str, str]:
    data: dict[str, str] = {}
    for key in (
        "SELECTEL_USER",
        "SELECTEL_USER_ID",
        "SELECTEL_PASSWORD",
        "SELECTEL_ACCOUNT_ID",
        "SELECTEL_PROJECT_NAME",
    ):
        v = os.environ.get(key, "").strip()
        if v:
            data[key] = v
    if os.path.isfile(CREDS_FILE):
        with open(CREDS_FILE, encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                data[k.strip()] = v.strip()
    required = (
        "SELECTEL_USER",
        "SELECTEL_PASSWORD",
        "SELECTEL_ACCOUNT_ID",
        "SELECTEL_PROJECT_NAME",
    )
    if not data.get("SELECTEL_PASSWORD"):
        print("Missing: SELECTEL_PASSWORD", file=sys.stderr)
        sys.exit(1)
    if not data.get("SELECTEL_USER") and not data.get("SELECTEL_USER_ID"):
        print("Missing: SELECTEL_USER or SELECTEL_USER_ID", file=sys.stderr)
        sys.exit(1)
    return data


def identity_user(c: dict[str, str]) -> dict:
    if c.get("SELECTEL_USER_ID"):
        return {"id": c["SELECTEL_USER_ID"], "password": c["SELECTEL_PASSWORD"]}
    return {
        "name": c["SELECTEL_USER"],
        "domain": {"name": c["SELECTEL_ACCOUNT_ID"]},
        "password": c["SELECTEL_PASSWORD"],
    }


def project_scope(c: dict[str, str], project: str, project_id: str | None = None) -> dict:
    if project_id:
        return {"project": {"id": project_id}}
    if c.get("SELECTEL_USER_ID"):
        return {"project": {"name": project}}
    return {
        "project": {
            "name": project,
            "domain": {"name": c["SELECTEL_ACCOUNT_ID"]},
        }
    }


def keystone_post(body: dict) -> tuple[int, str | None, str]:
    req = urllib.request.Request(
        KEYSTONE,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            token = resp.headers.get("X-Subject-Token") or resp.headers.get(
                "x-subject-token"
            )
            return resp.status, token, ""
    except urllib.error.HTTPError as e:
        return e.code, None, e.read().decode()[:800]


def discover_project(c: dict[str, str]) -> tuple[str, str]:
    """Auth by UID → list projects → (name, id)."""
    body = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {"user": identity_user(c)},
            }
        }
    }
    code, token, err = keystone_post(body)
    if not token:
        print("Auth failed", code, err, file=sys.stderr)
        sys.exit(1)
    req = urllib.request.Request(
        "https://cloud.api.selcloud.ru/identity/v3/auth/projects",
        headers={"X-Auth-Token": token},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print("List projects failed", e.code, e.read().decode()[:800], file=sys.stderr)
        sys.exit(1)
    projects = data.get("projects", [])
    if not projects:
        print("No projects for this user", file=sys.stderr)
        sys.exit(1)
    preferred = (c.get("SELECTEL_PROJECT_NAME") or "").strip()
    if preferred:
        for p in projects:
            if p.get("name") == preferred:
                return preferred, p.get("id", "")
    p = projects[0]
    print("Auto-selected project:", p.get("name"), p.get("id"))
    return p.get("name", ""), p.get("id", "")


def main() -> int:
    c = load_creds()
    if c.get("SELECTEL_USER_ID"):
        project, project_id = discover_project(c)
    else:
        if not c.get("SELECTEL_ACCOUNT_ID"):
            print("Missing SELECTEL_ACCOUNT_ID or SELECTEL_USER_ID", file=sys.stderr)
            return 1
        project = (c.get("SELECTEL_PROJECT_NAME") or "").strip()
        project_id = None
        if not project:
            print("Set SELECTEL_PROJECT_NAME for legacy auth", file=sys.stderr)
            return 1
    body = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {"user": identity_user(c)},
            },
            "scope": project_scope(c, project, project_id or None),
        }
    }
    code, token, err = keystone_post(body)
    if not token:
        print("Project-scoped auth failed", code, err, file=sys.stderr)
        return 1

    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(token.strip())
    os.chmod(TOKEN_FILE, 0o600)
    print("OK: IAM token saved to", TOKEN_FILE, "(valid ~24h)")
    print("Project:", project)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
