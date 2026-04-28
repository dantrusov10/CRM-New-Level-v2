#!/usr/bin/env python3
import argparse
import json
import sqlite3


def table_exists(cur, name):
    return cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


def table_columns(cur, name):
    return [r[1] for r in cur.execute(f"PRAGMA table_info({name})").fetchall()]


def run(db_path, tenant_codes, apply):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    tables = ["instances", "tenant_domains", "tenant_modules", "subscriptions", "tenant_registrations", "provisioning_jobs", "users"]
    summary = {}
    marks = ",".join(["?"] * len(tenant_codes))

    for t in tables:
        if not table_exists(cur, t):
            continue
        cols = table_columns(cur, t)
        key = "tenant_code" if "tenant_code" in cols else ("code" if "code" in cols else None)
        if not key:
            continue
        q = f"SELECT COUNT(*) FROM {t} WHERE {key} IN ({marks})"
        summary[t] = cur.execute(q, tenant_codes).fetchone()[0]

    summary["tenants"] = cur.execute(f"SELECT COUNT(*) FROM tenants WHERE code IN ({marks})", tenant_codes).fetchone()[0]

    if apply:
        for t in tables:
            if not table_exists(cur, t):
                continue
            cols = table_columns(cur, t)
            key = "tenant_code" if "tenant_code" in cols else ("code" if "code" in cols else None)
            if not key:
                continue
            q = f"DELETE FROM {t} WHERE {key} IN ({marks})"
            cur.execute(q, tenant_codes)
        cur.execute(f"DELETE FROM tenants WHERE code IN ({marks})", tenant_codes)
        con.commit()

    remaining = cur.execute("SELECT code, name, primary_domain FROM tenants ORDER BY code").fetchall()
    con.close()
    return {"deleted_counts": summary, "remaining_tenants": remaining, "applied": apply}


def main():
    p = argparse.ArgumentParser(description="Drop tenant records from control-plane DB.")
    p.add_argument("--control-db-path", default="/opt/pb-control/pb_data/data.db")
    p.add_argument("--tenant-code", action="append", required=True)
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    report = run(args.control_db_path, args.tenant_code, args.apply)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
