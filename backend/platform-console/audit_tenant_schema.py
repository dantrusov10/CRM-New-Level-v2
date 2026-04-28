#!/usr/bin/env python3
import argparse
import json
import os
import sys
from urllib.request import Request, urlopen


REQUIRED_COLLECTIONS = {
    "deals": ["stage_id", "company_id", "title"],
    "timeline": ["deal_id", "action", "comment"],
    "ai_insights": ["deal_id", "score", "summary", "suggestions", "risks", "explainability"],
    "contacts_found": ["deal_id"],
    "entity_files": ["entity_type", "entity_id"],
    "funnel_stages": ["position"],
}


def _http_json(url, method="GET", payload=None, headers=None):
    data = None
    h = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = Request(url, data=data, method=method, headers=h)
    with urlopen(req, timeout=25) as r:
        raw = r.read().decode("utf-8", errors="ignore")
    return json.loads(raw) if raw else {}


def _auth_admin(pb_url, email, password):
    base = pb_url.rstrip("/")
    data = _http_json(
        f"{base}/api/admins/auth-with-password",
        method="POST",
        payload={"identity": email, "password": password},
    )
    return str(data.get("token", "")).strip()


def _list_collections(pb_url, token):
    base = pb_url.rstrip("/")
    data = _http_json(
        f"{base}/api/collections?perPage=200",
        headers={"Authorization": token},
    )
    return data.get("items", []) if isinstance(data, dict) else []


def _field_names(schema_obj):
    if isinstance(schema_obj, list):
        fields = schema_obj
    elif isinstance(schema_obj, dict):
        fields = schema_obj.get("fields", [])
    else:
        return set()
    names = set()
    if isinstance(fields, list):
        for f in fields:
            if isinstance(f, dict) and f.get("name"):
                names.add(str(f.get("name")))
    return names


def audit_tenant(pb_url, email, password):
    out = {
        "tenant_pb_url": pb_url,
        "ok": True,
        "missing_collections": [],
        "missing_fields": {},
    }
    try:
        token = _auth_admin(pb_url, email, password)
        if not token:
            raise RuntimeError("empty admin token")
        items = _list_collections(pb_url, token)
        by_name = {}
        for c in items:
            if isinstance(c, dict):
                by_name[str(c.get("name", "")).strip()] = c
        for col, required_fields in REQUIRED_COLLECTIONS.items():
            rec = by_name.get(col)
            if not rec:
                out["missing_collections"].append(col)
                out["ok"] = False
                continue
            present = _field_names(rec.get("schema", {}))
            miss = [f for f in required_fields if f not in present]
            if miss:
                out["missing_fields"][col] = miss
                out["ok"] = False
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)
    return out


def parse_args():
    p = argparse.ArgumentParser(description="Audit tenant PocketBase schema for AI context readiness.")
    p.add_argument("--tenant", action="append", default=[], help="Tenant PB base URL, e.g. https://pb.nwlvl.ru")
    p.add_argument("--from-env", action="store_true", help="Read TENANT_PB_URLS CSV from environment")
    p.add_argument("--admin-email", default=os.getenv("TENANT_PB_ADMIN_EMAIL", ""), help="Tenant admin email")
    p.add_argument("--admin-password", default=os.getenv("TENANT_PB_ADMIN_PASSWORD", ""), help="Tenant admin password")
    return p.parse_args()


def main():
    args = parse_args()
    tenants = list(args.tenant or [])
    if args.from_env:
        env_urls = [x.strip() for x in str(os.getenv("TENANT_PB_URLS", "")).split(",") if x.strip()]
        tenants.extend(env_urls)
    tenants = sorted(set(tenants))
    if not tenants:
        print("No tenants provided. Use --tenant and/or --from-env TENANT_PB_URLS.")
        return 2
    if not args.admin_email or not args.admin_password:
        print("Missing admin credentials: --admin-email/--admin-password (or env TENANT_PB_ADMIN_*).")
        return 2

    report = {"ok": True, "tenants_total": len(tenants), "results": []}
    for t in tenants:
        r = audit_tenant(t, args.admin_email, args.admin_password)
        report["results"].append(r)
        if not r.get("ok"):
            report["ok"] = False

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
