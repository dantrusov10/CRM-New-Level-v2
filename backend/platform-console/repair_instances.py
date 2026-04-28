#!/usr/bin/env python3
import argparse
import json
import sqlite3
import ssl
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _http_json(url, method="GET", payload=None, insecure_tls=False, timeout=15, headers=None):
    data = None
    h = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = Request(url, method=method, data=data, headers=h)
    ctx = ssl._create_unverified_context() if insecure_tls and url.startswith("https://") else None
    with urlopen(req, timeout=timeout, context=ctx) as r:
        raw = r.read().decode("utf-8", errors="ignore")
        status = int(getattr(r, "status", 200))
    return status, (json.loads(raw) if raw else {})


def _probe_base(base, admin_email, admin_password, insecure_tls=False):
    out = {
        "base": base,
        "health_ok": False,
        "auth_ok": False,
        "collections_ok": False,
        "auth_endpoint": "",
        "error": "",
    }
    try:
        status, _ = _http_json(f"{base}/api/health", insecure_tls=insecure_tls)
        out["health_ok"] = status == 200
    except Exception:
        out["health_ok"] = False

    auth_variants = [
        f"{base}/api/admins/auth-with-password",
        f"{base}/api/collections/_superusers/auth-with-password",
    ]
    token = ""
    for ep in auth_variants:
        try:
            _, data = _http_json(
                ep,
                method="POST",
                payload={"identity": admin_email, "password": admin_password},
                insecure_tls=insecure_tls,
            )
            token = str((data or {}).get("token", "")).strip()
            if token:
                out["auth_ok"] = True
                out["auth_endpoint"] = ep
                break
        except HTTPError as e:
            out["error"] = f"{ep} -> {e.code}"
        except URLError as e:
            out["error"] = str(e)
        except Exception as e:
            out["error"] = str(e)

    if token:
        try:
            status, data = _http_json(
                f"{base}/api/collections?perPage=1",
                insecure_tls=insecure_tls,
                headers={"Authorization": token},
            )
            out["collections_ok"] = status == 200 and isinstance(data, dict)
        except Exception as e:
            out["error"] = str(e)

    return out


def _score_probe(p):
    if p["auth_ok"] and p["collections_ok"]:
        return 100
    if p["health_ok"]:
        return 30
    return 0


def _candidates(existing_pb_url, primary_domain):
    vals = []
    e = str(existing_pb_url or "").strip().rstrip("/")
    d = str(primary_domain or "").strip().lower()
    if e:
        vals.append(e)
    if d:
        vals.append(f"https://{d}")
        vals.append(f"http://{d}")
    out = []
    seen = set()
    for v in vals:
        if v and v not in seen:
            out.append(v)
            seen.add(v)
    return out


def repair_instances(db_path, admin_email, admin_password, insecure_tls=False, apply=False):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    rows = cur.execute(
        """
        SELECT i.id, i.tenant_code, i.pb_url, t.primary_domain
        FROM instances i
        JOIN tenants t ON t.code=i.tenant_code
        WHERE i.status='active' AND t.status='active' AND t.is_active=1
        ORDER BY i.tenant_code
        """
    ).fetchall()
    report = {"instances_total": len(rows), "updated": [], "unchanged": [], "failed": []}
    for rid, tenant_code, pb_url, primary_domain in rows:
        probes = []
        for base in _candidates(pb_url, primary_domain):
            probes.append(_probe_base(base, admin_email, admin_password, insecure_tls=insecure_tls))
        probes.sort(key=_score_probe, reverse=True)
        best = probes[0] if probes else None
        if not best or _score_probe(best) == 0:
            report["failed"].append(
                {"tenant_code": tenant_code, "current_pb_url": pb_url, "primary_domain": primary_domain, "probes": probes}
            )
            continue
        chosen = best["base"]
        current = str(pb_url or "").strip().rstrip("/")
        if chosen != current:
            if apply:
                cur.execute(
                    "UPDATE instances SET pb_url=?, updated=strftime('%Y-%m-%d %H:%M:%fZ') WHERE id=?",
                    (chosen, rid),
                )
            report["updated"].append(
                {"tenant_code": tenant_code, "from": current, "to": chosen, "probe": best}
            )
        else:
            report["unchanged"].append({"tenant_code": tenant_code, "pb_url": current, "probe": best})
    if apply:
        con.commit()
    con.close()
    return report


def main():
    p = argparse.ArgumentParser(description="Repair tenant instances.pb_url by probing working PB endpoints.")
    p.add_argument("--control-db-path", default="/opt/pb-control/pb_data/data.db")
    p.add_argument("--admin-email", required=True)
    p.add_argument("--admin-password", required=True)
    p.add_argument("--insecure-tls", action="store_true")
    p.add_argument("--apply", action="store_true", help="Persist pb_url updates to control DB")
    args = p.parse_args()

    report = repair_instances(
        args.control_db_path,
        args.admin_email,
        args.admin_password,
        insecure_tls=args.insecure_tls,
        apply=args.apply,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
