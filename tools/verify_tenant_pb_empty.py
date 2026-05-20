#!/usr/bin/env python3
"""
Verify tenant PocketBase data.db row counts.

Without --expect-json: legacy check — только коллекция users = 1 запись, остальные кастомные = 0,
_superusers = 1.

С --expect-json (expected_record_counts.json): проверка целевых счётчиков для предконфигурации.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pb-data-dir", required=True)
    ap.add_argument(
        "--expect-json",
        default="",
        help="Файл с ключом by_collection_name: имя коллекции -> ожидаемое число строк",
    )
    args = ap.parse_args()
    db_path = f"{args.pb_data_dir.rstrip('/')}/data.db"
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        cur.execute("SELECT id, name, type, system FROM _collections WHERE system = 0 ORDER BY name")
        rows = cur.fetchall()
        if not rows:
            raise SystemExit("No custom collections found (_collections empty?).")

        failures: list[str] = []

        cur.execute("SELECT COUNT(*) FROM _superusers")
        super_count = int(cur.fetchone()[0])
        if super_count != 1:
            failures.append(f"_superusers: expected 1 row, got {super_count}")

        expect_by_name: dict[str, int] = {}
        if args.expect_json and args.expect_json.strip():
            with open(args.expect_json, encoding="utf-8") as f:
                data = json.load(f)
            raw = data.get("by_collection_name")
            if isinstance(raw, dict):
                expect_by_name = {str(k): int(v) for k, v in raw.items()}

        users_table_id: str | None = None
        for cid, name, typ, _sys in rows:
            if typ not in ("base", "auth"):
                continue
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{cid}"')
            except sqlite3.Error as ex:
                failures.append(f'collection "{name}" ({cid}): cannot COUNT — {ex}')
                continue
            cnt = int(cur.fetchone()[0])

            if name == "users":
                users_table_id = cid
                if cnt != 1:
                    failures.append(f'users collection: expected exactly 1 row, got {cnt}')
                continue

            if expect_by_name:
                expected = expect_by_name.get(name, 0)
                if cnt != expected:
                    failures.append(f'collection "{name}": expected {expected} rows, got {cnt}')
            else:
                if cnt != 0:
                    failures.append(f'collection "{name}" ({cid}): expected 0 rows, got {cnt}')

        if users_table_id is None:
            failures.append('No collection named "users" found in _collections.')

        if failures:
            print("verify_tenant_pb_empty.py FAILED:", file=sys.stderr)
            for line in failures:
                print(f"  - {line}", file=sys.stderr)
            raise SystemExit(1)
        mode = "seed expectations" if expect_by_name else "empty (users only)"
        print(f"OK: tenant DB {db_path} verified ({mode}).")
    finally:
        con.close()


if __name__ == "__main__":
    main()
