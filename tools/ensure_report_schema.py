"""Ensure report-builder fields and saved_reports exist in PocketBase tenant(s).

Compatible with PocketBase 0.22 (admins + schema) and newer (_superusers + fields).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "")
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "")


def request(base: str, path: str, method: str = "GET", token: str = "", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(f"{base.rstrip('/')}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise urllib.error.HTTPError(exc.url, exc.code, f"{exc.reason}: {body}", exc.headers, None) from None


def authenticate(base: str) -> str:
    payload = {"identity": PB_ADMIN_EMAIL, "password": PB_ADMIN_PASSWORD}
    last_error = None
    for path in (
        "/api/admins/auth-with-password",
        "/api/collections/_superusers/auth-with-password",
    ):
        try:
            return str(request(base, path, "POST", payload=payload)["token"])
        except (KeyError, urllib.error.HTTPError) as exc:
            last_error = exc
    raise RuntimeError(f"PocketBase authentication failed: {last_error}")


def schema_key(collection: dict) -> str:
    return "fields" if "fields" in collection and collection.get("fields") is not None else "schema"


def text_field(field_id: str, name: str) -> dict:
    return {
        "id": field_id,
        "name": name,
        "type": "text",
        "system": False,
        "required": False,
        "presentable": False,
        "unique": False,
        "options": {"min": None, "max": None, "pattern": ""},
    }


def json_field(field_id: str, name: str, max_size: int = 2_000_000) -> dict:
    return {
        "id": field_id,
        "name": name,
        "type": "json",
        "system": False,
        "required": False,
        "presentable": False,
        "unique": False,
        "options": {"maxSize": max_size},
    }


def ensure_deal_fields(base: str, token: str) -> None:
    collection = request(base, "/api/collections/deals", token=token)
    key = schema_key(collection)
    fields = list(collection.get(key) or [])
    existing = {str(field.get("name")) for field in fields}
    wanted = [
        ("loss_reason", text_field("lossreasonfld01", "loss_reason")),
        ("pilot_checklist", json_field("pilotcheckfld01", "pilot_checklist")),
        ("product_ids", json_field("dm7k2p9qx4deal1", "product_ids")),
    ]
    added = []
    for name, field in wanted:
        if name not in existing:
            fields.append(field)
            added.append(name)
    if added:
        request(base, f"/api/collections/{collection['id']}", "PATCH", token, {key: fields})
        print(f"{base}: created deals.{', deals.'.join(added)}")
    else:
        print(f"{base}: deal report fields already exist")


def ensure_saved_reports(base: str, token: str) -> None:
    try:
        request(base, "/api/collections/saved_reports", token=token)
        print(f"{base}: saved_reports already exists")
        return
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise

    users = request(base, "/api/collections/users", token=token)
    key = schema_key(users)
    fields = [
        {
            "id": "sruserrel00001",
            "name": "user_id",
            "type": "relation",
            "system": False,
            "required": True,
            "presentable": False,
            "unique": False,
            "options": {
                "collectionId": users["id"],
                "cascadeDelete": True,
                "minSelect": None,
                "maxSelect": 1,
                "displayFields": None,
            },
        },
        text_field("srnamefld00001", "name") | {"required": True},
        {
            "id": "srsourcefld001",
            "name": "source",
            "type": "select",
            "system": False,
            "required": True,
            "presentable": False,
            "unique": False,
            "options": {"maxSelect": 1, "values": ["deals", "companies"]},
        },
        json_field("srreportjson01", "report_json"),
        json_field("srlayoutjson01", "layout_json"),
        {
            "id": "srcreatedat001",
            "name": "created_at",
            "type": "date",
            "system": False,
            "required": False,
            "presentable": False,
            "unique": False,
            "options": {"min": None, "max": None},
        },
    ]
    auth_rule = '@request.auth.id != "" && user_id = @request.auth.id'
    payload = {
        "name": "saved_reports",
        "type": "base",
        "system": False,
        "listRule": auth_rule,
        "viewRule": auth_rule,
        "createRule": '@request.auth.id != ""',
        "updateRule": auth_rule,
        "deleteRule": auth_rule,
        "options": {},
        key: fields,
    }
    request(base, "/api/collections", "POST", token, payload)
    print(f"{base}: created saved_reports")


def main() -> int:
    raw_urls = os.getenv("PB_URLS", "") or os.getenv("PB_URL", "")
    urls = [url.strip().rstrip("/") for url in raw_urls.split(",") if url.strip()]
    if not (urls and PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD):
        print("Set PB_URL (or PB_URLS), PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD, then run this script.")
        return 0

    failed = False
    for base in urls:
        try:
            token = authenticate(base)
            ensure_deal_fields(base, token)
            ensure_saved_reports(base, token)
        except Exception as exc:  # noqa: BLE001 - report each tenant failure
            failed = True
            print(f"{base}: could not update PocketBase: {exc}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
