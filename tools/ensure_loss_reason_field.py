"""Ensure the PocketBase deals collection has a text field named loss_reason."""

import json
import os
import sys
import urllib.error
import urllib.request


PB_URL = os.getenv("PB_URL", "").rstrip("/")
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "")
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "")


def request(path: str, method: str = "GET", token: str = "", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(f"{PB_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def main() -> int:
    if not (PB_URL and PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD):
        print(
            "Set PB_URL, PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD, then run this script. "
            "Alternatively import backend/pocketbase/collections.json in PocketBase."
        )
        return 0
    try:
        auth = request(
            "/api/collections/_superusers/auth-with-password",
            "POST",
            payload={"identity": PB_ADMIN_EMAIL, "password": PB_ADMIN_PASSWORD},
        )
        token = auth["token"]
        collection = request("/api/collections/deals", token=token)
        fields = collection.get("fields") or collection.get("schema") or []
        if any(field.get("name") == "loss_reason" for field in fields):
            print("loss_reason already exists")
            return 0
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
        key = "fields" if "fields" in collection else "schema"
        request(f"/api/collections/{collection['id']}", "PATCH", token, {key: fields})
        print("Created deals.loss_reason")
        return 0
    except (KeyError, urllib.error.URLError, urllib.error.HTTPError) as exc:
        print(f"Could not update PocketBase: {exc}", file=sys.stderr)
        print("Import backend/pocketbase/collections.json or create a text field deals.loss_reason manually.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
