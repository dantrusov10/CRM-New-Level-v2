#!/usr/bin/env python3
import argparse
import json
import os
import sys
import sqlite3
import ssl
from urllib.request import Request, urlopen


REQUIRED_COLLECTIONS = {
    "deals": ["stage_id", "company_id", "title"],
    "timeline": ["deal_id", "action", "comment"],
    "ai_insights": ["deal_id", "score", "summary", "suggestions", "risks", "explainability"],
    "contacts_found": ["deal_id"],
    "entity_files": ["entity_type", "entity_id"],
    "funnel_stages": ["position"],
}

COLLECTION_ALIASES = {
    "funnel_stages": ["funnel_stages", "settings_funnel_stages"],
}

EXPECTED_RELATIONS = {
    "deals": {
        "stage_id": "settings_funnel_stages",
        "company_id": "companies",
    },
    "timeline": {
        "deal_id": "deals",
    },
    "ai_insights": {
        "deal_id": "deals",
    },
    "contacts_found": {
        "deal_id": "deals",
    },
    "entity_files": {
        # entity_id is used together with entity_type and may be text in some tenants
    },
}


def _http_json(url, method="GET", payload=None, headers=None, insecure_tls=False):
    data = None
    h = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = Request(url, data=data, method=method, headers=h)
    ctx = None
    if insecure_tls and str(url).startswith("https://"):
        ctx = ssl._create_unverified_context()
    with urlopen(req, timeout=25, context=ctx) as r:
        raw = r.read().decode("utf-8", errors="ignore")
    return json.loads(raw) if raw else {}


def _auth_admin(pb_url, email, password, insecure_tls=False):
    base = pb_url.rstrip("/")
    variants = [
        f"{base}/api/admins/auth-with-password",
        f"{base}/api/collections/_superusers/auth-with-password",
    ]
    last_err = None
    for url in variants:
        try:
            data = _http_json(
                url,
                method="POST",
                payload={"identity": email, "password": password},
                insecure_tls=insecure_tls,
            )
            tok = str((data or {}).get("token", "")).strip()
            if tok:
                return tok
        except Exception as e:
            last_err = e
    if last_err:
        raise last_err
    return ""


def _list_collections(pb_url, token, insecure_tls=False):
    base = pb_url.rstrip("/")
    data = _http_json(
        f"{base}/api/collections?perPage=200",
        headers={"Authorization": token},
        insecure_tls=insecure_tls,
    )
    return data.get("items", []) if isinstance(data, dict) else []


def _create_collection(pb_url, token, payload, insecure_tls=False):
    base = pb_url.rstrip("/")
    return _http_json(
        f"{base}/api/collections",
        method="POST",
        payload=payload,
        headers={"Authorization": token},
        insecure_tls=insecure_tls,
    )


def _update_collection(pb_url, token, collection_id, payload, insecure_tls=False):
    base = pb_url.rstrip("/")
    return _http_json(
        f"{base}/api/collections/{collection_id}",
        method="PATCH",
        payload=payload,
        headers={"Authorization": token},
        insecure_tls=insecure_tls,
    )


def _load_collection_templates(schema_file):
    if not schema_file:
        return {}
    with open(schema_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data if isinstance(data, list) else data.get("collections", [])
    out = {}
    for c in items:
        if isinstance(c, dict) and c.get("name"):
            out[str(c["name"])] = c
    if "funnel_stages" not in out and "settings_funnel_stages" in out:
        fs = dict(out["settings_funnel_stages"])
        fs["name"] = "funnel_stages"
        out["funnel_stages"] = fs
    return out


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


def _field_map(schema_obj):
    if isinstance(schema_obj, list):
        fields = schema_obj
    elif isinstance(schema_obj, dict):
        fields = schema_obj.get("fields", [])
    else:
        return {}
    out = {}
    if isinstance(fields, list):
        for f in fields:
            if isinstance(f, dict) and f.get("name"):
                out[str(f.get("name"))] = f
    return out


def _relation_issues(by_name):
    by_id = {}
    for n, rec in by_name.items():
        rid = str((rec or {}).get("id", ""))
        if rid:
            by_id[rid] = n
    issues = []
    for col, rels in EXPECTED_RELATIONS.items():
        rec = by_name.get(col)
        if not rec:
            continue
        fmap = _field_map(rec.get("schema", {}))
        for field_name, expected_target in rels.items():
            fld = fmap.get(field_name)
            if not isinstance(fld, dict):
                continue
            if str(fld.get("type", "")).lower() != "relation":
                issues.append(f"{col}.{field_name}: type is not relation")
                continue
            opts = fld.get("options", {}) if isinstance(fld.get("options"), dict) else {}
            target_id = str(opts.get("collectionId", "")).strip()
            target_name = by_id.get(target_id, "")
            if target_id and target_name and target_name != expected_target:
                issues.append(f"{col}.{field_name}: points to '{target_name}', expected '{expected_target}'")
    return issues


def audit_tenant(pb_url, email, password, insecure_tls=False):
    out = {
        "tenant_pb_url": pb_url,
        "ok": True,
        "missing_collections": [],
        "missing_fields": {},
        "relation_issues": [],
    }
    try:
        token = _auth_admin(pb_url, email, password, insecure_tls=insecure_tls)
        if not token:
            raise RuntimeError("empty admin token")
        items = _list_collections(pb_url, token, insecure_tls=insecure_tls)
        by_name = {}
        for c in items:
            if isinstance(c, dict):
                by_name[str(c.get("name", "")).strip()] = c
        for col, required_fields in REQUIRED_COLLECTIONS.items():
            aliases = COLLECTION_ALIASES.get(col, [col])
            rec = None
            for alias in aliases:
                rec = by_name.get(alias)
                if rec:
                    break
            if not rec:
                out["missing_collections"].append(col)
                out["ok"] = False
                continue
            present = _field_names(rec.get("schema", {}))
            miss = [f for f in required_fields if f not in present]
            if miss:
                out["missing_fields"][col] = miss
                out["ok"] = False
        out["relation_issues"] = _relation_issues(by_name)
        if out["relation_issues"]:
            out["ok"] = False
    except Exception as e:
        out["ok"] = False
        out["error"] = str(e)
    return out


def _template_payload_for_create(template):
    payload = {
        "name": template.get("name"),
        "type": template.get("type", "base"),
        "schema": template.get("schema", []),
        "listRule": template.get("listRule"),
        "viewRule": template.get("viewRule"),
        "createRule": template.get("createRule"),
        "updateRule": template.get("updateRule"),
        "deleteRule": template.get("deleteRule"),
        "options": template.get("options", {}),
    }
    return payload


def _apply_fix(pb_url, email, password, templates, insecure_tls=False):
    res = {"tenant_pb_url": pb_url, "fixed_collections": [], "fixed_fields": {}, "errors": []}
    try:
        token = _auth_admin(pb_url, email, password, insecure_tls=insecure_tls)
        items = _list_collections(pb_url, token, insecure_tls=insecure_tls)
    except Exception as e:
        res["errors"].append(f"auth_or_list_failed: {e}")
        return res
    by_name = {}
    for c in items:
        if isinstance(c, dict):
            by_name[str(c.get("name", "")).strip()] = c

    for col, required_fields in REQUIRED_COLLECTIONS.items():
        aliases = COLLECTION_ALIASES.get(col, [col])
        rec = None
        for alias in aliases:
            rec = by_name.get(alias)
            if rec:
                break
        tmpl = templates.get(col)
        if not rec:
            if not tmpl:
                res["errors"].append(f"{col}: missing and no template provided")
                continue
            try:
                _create_collection(pb_url, token, _template_payload_for_create(tmpl), insecure_tls=insecure_tls)
                res["fixed_collections"].append(col)
            except Exception as e:
                res["errors"].append(f"{col}: create failed: {e}")
            continue

        missing = [f for f in required_fields if f not in _field_names(rec.get("schema", {}))]
        if not missing:
            continue
        if not tmpl:
            res["errors"].append(f"{col}: missing fields {missing}, no template")
            continue
        tmpl_map = _field_map(tmpl.get("schema", []))
        rec_fields = rec.get("schema", [])
        if isinstance(rec_fields, dict):
            rec_fields = rec_fields.get("fields", [])
        if not isinstance(rec_fields, list):
            rec_fields = []
        appended = []
        for mf in missing:
            fld = tmpl_map.get(mf)
            if isinstance(fld, dict):
                rec_fields.append(fld)
                appended.append(mf)
        if not appended:
            res["errors"].append(f"{col}: no template fields available for {missing}")
            continue
        try:
            _update_collection(pb_url, token, str(rec.get("id", "")), {"schema": rec_fields}, insecure_tls=insecure_tls)
            res["fixed_fields"][col] = appended
        except Exception as e:
            res["errors"].append(f"{col}: update failed: {e}")
    return res


def tenants_from_control_db(db_path):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    sql = """
        SELECT i.pb_url
        FROM instances i
        JOIN tenants t ON t.code=i.tenant_code
        WHERE t.is_active=1 AND t.status='active' AND i.status='active' AND i.pb_url<>''
    """
    rows = cur.execute(sql).fetchall()
    con.close()
    out = []
    for r in rows:
        u = str(r[0] or "").strip()
        if not u:
            continue
        out.append(u)
    return sorted(set(out))


def parse_args():
    p = argparse.ArgumentParser(description="Audit tenant PocketBase schema for AI context readiness.")
    p.add_argument("--tenant", action="append", default=[], help="Tenant PB base URL, e.g. https://pb.nwlvl.ru")
    p.add_argument("--from-env", action="store_true", help="Read TENANT_PB_URLS CSV from environment")
    p.add_argument("--from-control-db", action="store_true", help="Read active tenants from control DB")
    p.add_argument("--control-db-path", default=os.getenv("CONTROL_DB_PATH", "/opt/pb-control/pb_data/data.db"))
    p.add_argument("--fix", action="store_true", help="Create/fix missing collections and fields using templates")
    p.add_argument("--schema-template-file", default="", help="Path to collections.json templates")
    p.add_argument("--insecure-tls", action="store_true", help="Disable TLS verification for tenant endpoints")
    p.add_argument("--admin-email", default=os.getenv("TENANT_PB_ADMIN_EMAIL", ""), help="Tenant admin email")
    p.add_argument("--admin-password", default=os.getenv("TENANT_PB_ADMIN_PASSWORD", ""), help="Tenant admin password")
    return p.parse_args()


def main():
    args = parse_args()
    tenants = list(args.tenant or [])
    if args.from_env:
        env_urls = [x.strip() for x in str(os.getenv("TENANT_PB_URLS", "")).split(",") if x.strip()]
        tenants.extend(env_urls)
    if args.from_control_db:
        tenants.extend(tenants_from_control_db(args.control_db_path))
    tenants = sorted(set(tenants))
    if not tenants:
        print("No tenants provided. Use --tenant and/or --from-env TENANT_PB_URLS.")
        return 2
    if not args.admin_email or not args.admin_password:
        print("Missing admin credentials: --admin-email/--admin-password (or env TENANT_PB_ADMIN_*).")
        return 2

    templates = {}
    if args.fix:
        templates = _load_collection_templates(args.schema_template_file)
    report = {"ok": True, "tenants_total": len(tenants), "results": [], "fix_results": []}
    for t in tenants:
        if args.fix:
            fr = _apply_fix(t, args.admin_email, args.admin_password, templates, insecure_tls=args.insecure_tls)
            report["fix_results"].append(fr)
        r = audit_tenant(t, args.admin_email, args.admin_password, insecure_tls=args.insecure_tls)
        report["results"].append(r)
        if not r.get("ok"):
            report["ok"] = False

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
