#!/usr/bin/env python3
"""
Миграция deal_field_values → deals.* для канонических полей (волна 2.5-D).

Использование:
  PB_URL=https://... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... python tools/migrate_deal_canonical_fields.py
  python tools/migrate_deal_canonical_fields.py --dry-run

Переносит value_number/value_text в deals.budget, deals.turnover и т.д.,
если в deals поле пустое. Обновляет settings_fields.field_name на канон.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

CANONICAL = {
    "budget": ["budget", "deal_budget", "бюджет", "sum", "сумма"],
    "turnover": ["turnover", "deal_turnover", "оборот", "revenue"],
    "sales_channel": ["sales_channel", "channel", "канал", "канал_продаж"],
    "partner": ["partner", "партнер", "партнёр"],
    "distributor": ["distributor", "дистрибьютор"],
    "margin_percent": ["margin_percent", "margin", "маржа"],
    "discount_percent": ["discount_percent", "discount", "скидка"],
}


def normalize(name: str) -> str | None:
    n = (name or "").strip().lower()
    for canon, aliases in CANONICAL.items():
        if n == canon or n in aliases:
            return canon
    return None


def parse_num(v: Any) -> float | None:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"\s+", "", str(v)).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


class PB:
    def __init__(self, base: str, email: str, password: str):
        self.base = base.rstrip("/")
        self.session = requests.Session()
        r = self.session.post(
            f"{self.base}/api/admins/auth-with-password",
            json={"identity": email, "password": password},
            timeout=60,
        )
        if r.status_code == 404:
            r = self.session.post(
                f"{self.base}/api/collections/_superusers/auth-with-password",
                json={"identity": email, "password": password},
                timeout=60,
            )
        r.raise_for_status()
        self.token = r.json().get("token")
        self.session.headers["Authorization"] = f"Bearer {self.token}"

    def list_all(self, collection: str, **params) -> list[dict]:
        page = 1
        out: list[dict] = []
        while True:
            p = {"page": page, "perPage": 200, **params}
            r = self.session.get(f"{self.base}/api/collections/{collection}/records", params=p, timeout=120)
            r.raise_for_status()
            data = r.json()
            items = data.get("items") or []
            out.extend(items)
            if page >= data.get("totalPages", 1):
                break
            page += 1
        return out

    def update(self, collection: str, rid: str, payload: dict) -> None:
        r = self.session.patch(f"{self.base}/api/collections/{collection}/records/{rid}", json=payload, timeout=60)
        r.raise_for_status()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    base = os.environ.get("PB_URL", "").strip()
    email = os.environ.get("PB_ADMIN_EMAIL", "").strip()
    password = os.environ.get("PB_ADMIN_PASSWORD", "").strip()
    if not base or not email or not password:
        print("Set PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD", file=sys.stderr)
        return 2

    pb = PB(base, email, password)
    fields = pb.list_all("settings_fields", filter='entity_type="deal"')
    field_by_id: dict[str, dict] = {f["id"]: f for f in fields}

    renamed = 0
    for f in fields:
        fn = str(f.get("field_name") or "")
        canon = normalize(fn)
        if canon and fn != canon:
            print(f"field {f['id']}: {fn} -> {canon}")
            if not args.dry_run:
                pb.update("settings_fields", f["id"], {"field_name": canon})
            renamed += 1

    values = pb.list_all("deal_field_values")
    migrated = 0
    skipped = 0
    for row in values:
        fid = row.get("field_id")
        deal_id = row.get("deal_id")
        if not fid or not deal_id:
            continue
        field = field_by_id.get(fid)
        if not field:
            continue
        canon = normalize(str(field.get("field_name") or ""))
        if not canon:
            continue
        num = parse_num(row.get("value_number"))
        if num is None:
            num = parse_num(row.get("value_text"))
        if num is None and not row.get("value_text"):
            continue
        deals = pb.list_all("deals", filter=f'id="{deal_id}"')
        if not deals:
            continue
        deal = deals[0]
        current = deal.get(canon)
        if current not in (None, "", 0):
            skipped += 1
            continue
        payload_val = num if num is not None else row.get("value_text")
        print(f"deal {deal_id}: {canon} = {payload_val}")
        if not args.dry_run:
            pb.update("deals", deal_id, {canon: payload_val})
        migrated += 1

    print(f"Done. Renamed fields: {renamed}, migrated values: {migrated}, skipped (already set): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
