"""Ensure report-builder fields and saved_reports exist in PocketBase tenant(s)."""

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
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def authenticate(base: str) -> str:
    payload = {"identity": PB_ADMIN_EMAIL, "password": PB_ADMIN_PASSWORD}
    last_error = None
    for path in ("/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"):
        try:
            return str(request(base, path, "POST", payload=payload)["token"])
        except urllib.error.HTTPError as exc:
            last_error = exc
    if last_error:
        raise last_error
    raise RuntimeError("PocketBase authentication failed")


def ensure_deal_fields(base: str, token: str) -> None:
    collection = request(base, "/api/collections/deals", token=token)
    key = "fields" if "fields" in collection else "schema"
    fields = list(collection.get(key) or [])
    existing = {str(field.get("name")) for field in fields}
    added = []
    if "loss_reason" not in existing:
        fields.append(
            {
                "id": "lossreasonfld01",
                "name": "loss_reason",
                "type": "text",
                "required": False,
                "presentable": False,
                "unique": False,
                "options": {"min": None, "max": None, "pattern": ""},
            }
        )
        added.append("loss_reason")
    if "pilot_checklist" not in existing:
        fields.append(
            {
                "id": "pilotcheckfld01",
                "name": "pilot_checklist",
                "type": "json",
                "required": False,
                "presentable": False,
                "unique": False,
                "options": {"maxSize": 2_000_000},
            }
        )
        added.append("pilot_checklist")
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
    fields = [
        {
            "id": "sruserrel00001",
            "name": "user_id",
            "type": "relation",
            "required": True,
            "presentable": False,
            "unique": False,
            "options": {
                "collectionId": users["id"],
                "cascadeDelete": True,
                "minSelect": 1,
                "maxSelect": 1,
                "displayFields": None,
            },
        },
        {
            "id": "srnamefld00001",
            "name": "name",
            "type": "text",
            "required": True,
            "presentable": False,
            "unique": False,
            "options": {"min": None, "max": None, "pattern": ""},
        },
        {
            "id": "srsourcefld001",
            "name": "source",
            "type": "select",
            "required": True,
            "presentable": False,
            "unique": False,
            "options": {"maxSelect": 1, "values": ["deals", "companies"]},
        },
        {
            "id": "srreportjson01",
            "name": "report_json",
            "type": "json",
            "required": False,
            "presentable": False,
            "unique": False,
            "options": {"maxSize": 2_000_000},
        },
        {
            "id": "srlayoutjson01",
            "name": "layout_json",
            "type": "json",
            "required": False,
            "presentable": False,
            "unique": False,
            "options": {"maxSize": 2_000_000},
        },
        {
            "id": "srcreatedat001",
            "name": "created_at",
            "type": "date",
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
        "indexes": [],
        "listRule": auth_rule,
        "viewRule": auth_rule,
        "createRule": '@request.auth.id != ""',
        "updateRule": auth_rule,
        "deleteRule": auth_rule,
    }
    payload["fields" if "fields" in users else "schema"] = fields
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
        except (KeyError, RuntimeError, urllib.error.URLError, urllib.error.HTTPError) as exc:
            failed = True
            print(f"{base}: could not update PocketBase: {exc}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
