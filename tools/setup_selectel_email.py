#!/usr/bin/env python3
"""
Selectel Email Service + DNS for nwlvl.ru (crm@nwlvl.ru SMTP).

Requires IAM token (project scope): https://docs.selectel.ru/api/authorization/
  export SELECTEL_IAM_TOKEN='...'
  or: echo 'TOKEN' > /opt/pb-control/.selectel_iam_token && chmod 600 ...

Optional DKIM (copy from my.selectel.ru → Почтовый сервис → домен → DKIM):
  python3 setup_selectel_email.py --dkim 'v=DKIM1; k=rsa; p=...'

Apply SMTP on server after success:
  bash /opt/pb-control/apply_selectel_smtp.sh
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DOMAIN = os.environ.get("SELECTEL_DOMAIN", "nwlvl.ru").strip().rstrip(".")
RESOURCE_NAME = os.environ.get("SELECTEL_SES_NAME", "NewLevel CRM")
TOKEN_FILE = os.environ.get("SELECTEL_IAM_TOKEN_FILE", "/opt/pb-control/.selectel_iam_token")

SES_BASE = "https://api.selectel.ru/ses"
DNS_BASE = "https://api.selectel.ru/domains/v2"


def load_token() -> str:
    t = os.environ.get("SELECTEL_IAM_TOKEN", "").strip()
    if not t and os.path.isfile(TOKEN_FILE):
        with open(TOKEN_FILE, encoding="utf-8") as f:
            t = f.read().strip()
    if not t:
        print(
            "Нужен SELECTEL_IAM_TOKEN или файл",
            TOKEN_FILE,
            file=sys.stderr,
        )
        print(
            "Панель: my.selectel.ru → Аккаунт → Пользователи → сервисный пользователь "
            "→ IAM-токен для проекта (24ч) или Keystone API.",
            file=sys.stderr,
        )
        sys.exit(1)
    return t


def api(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, dict | list | str]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-Auth-Token": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode()
            if not raw:
                return resp.status, {}
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return e.code, parsed


def fqdn(name: str) -> str:
    n = name.strip().rstrip(".")
    return f"{n}."


def find_zone(token: str) -> dict | None:
    code, data = api("GET", f"{DNS_BASE}/zones?filter={DOMAIN}", token)
    if code != 200:
        print("DNS zones list failed", code, data, file=sys.stderr)
        return None
    for z in data.get("result", []):
        zn = str(z.get("name", "")).rstrip(".")
        if zn == DOMAIN:
            return z
    return None


def list_rrsets(token: str, zone_id: str, name: str, rtype: str) -> list[dict]:
    q = urllib.parse.quote(fqdn(name), safe="")
    code, data = api(
        "GET",
        f"{DNS_BASE}/zones/{zone_id}/rrset?name={q}&rrset_types={rtype}",
        token,
    )
    if code != 200:
        return []
    want = name.strip().rstrip(".").lower()
    out = []
    for rr in data.get("result", []):
        got = str(rr.get("name", "")).strip().rstrip(".").lower()
        if got == want:
            out.append(rr)
    return out


def dns_txt_content(value: str) -> str:
    """Selectel DNS API expects TXT payload in quotes."""
    v = value.strip()
    if len(v) >= 2 and v[0] == '"' and v[-1] == '"':
        return v
    return f'"{v}"'


def upsert_txt(
    token: str,
    zone_id: str,
    name: str,
    value: str,
    comment: str,
    *,
    merge: bool = False,
) -> bool:
    existing = list_rrsets(token, zone_id, name, "TXT")
    rec_name = fqdn(name)
    new_rec = {"content": dns_txt_content(value), "disabled": False}
    records = [new_rec]
    if merge and existing:
        seen = {new_rec["content"]}
        for rec in existing[0].get("records", []):
            c = rec.get("content", "")
            if c not in seen:
                records.append({"content": c, "disabled": False})
                seen.add(c)
    if existing:
        rid = existing[0]["id"]
        code, data = api(
            "PATCH",
            f"{DNS_BASE}/zones/{zone_id}/rrset/{rid}",
            token,
            {"ttl": 300, "records": records, "comment": comment},
        )
        ok = code == 204
        print(f"  TXT {name}: {'updated' if ok else f'FAIL {code} {data}'}")
        return ok
    code, data = api(
        "POST",
        f"{DNS_BASE}/zones/{zone_id}/rrset",
        token,
        {"name": rec_name, "type": "TXT", "ttl": 300, "records": records, "comment": comment},
    )
    ok = code == 200
    print(f"  TXT {name}: {'created' if ok else f'FAIL {code} {data}'}")
    return ok


def ensure_spf(token: str, zone_id: str) -> None:
    spf = "v=spf1 include:spf.mail.selcloud.ru ?all"
    existing = list_rrsets(token, zone_id, DOMAIN, "TXT")
    for rr in existing:
        for rec in rr.get("records", []):
            c = str(rec.get("content", "")).strip('"')
            if "v=spf1" in c and "spf.mail.selcloud.ru" in c:
                print("  SPF: already includes spf.mail.selcloud.ru")
                return
    upsert_txt(token, zone_id, DOMAIN, spf, "CRM SPF Selectel", merge=True)


def get_or_create_resource(token: str) -> dict:
    code, data = api("GET", f"{SES_BASE}/resources", token)
    if code != 200:
        print("SES list failed", code, data, file=sys.stderr)
        sys.exit(1)
    for r in data.get("resources", []):
        if r.get("name") == RESOURCE_NAME:
            print("SES resource exists:", r.get("id"), r.get("name"))
            return r
    code, created = api("POST", f"{SES_BASE}/resources", token, {"name": RESOURCE_NAME})
    if code not in (200, 201):
        print("SES create failed", code, created, file=sys.stderr)
        sys.exit(1)
    print("SES resource created:", created.get("id"))
    return created


def link_domain(token: str, ses_id: str) -> bool:
    code, doms = api("GET", f"{SES_BASE}/resources/{ses_id}/domains", token)
    if code == 200 and DOMAIN in doms.get("domains", []):
        print(f"Domain {DOMAIN} already linked")
        return True
    code, linked = api(
        "POST",
        f"{SES_BASE}/resources/{ses_id}/domains",
        token,
        {"name": DOMAIN},
    )
    if code in (200, 201):
        print(f"Domain {DOMAIN} linked")
        return True
    print("Link domain:", code, linked)
    return False


def check_verification(token: str, ses_id: str) -> dict:
    q = urllib.parse.urlencode({"name": DOMAIN})
    code, data = api("GET", f"{SES_BASE}/resources/{ses_id}/domains/check?{q}", token)
    if code == 200:
        return data.get("verification", {})
    return {}


def save_credentials(resource: dict) -> None:
    out = os.environ.get(
        "SELECTEL_SMTP_META_FILE", "/opt/pb-control/.selectel_smtp_meta.json"
    )
    meta = {
        "smtp_host": "smtp.mail.selcloud.ru",
        "smtp_port_tls": 1127,
        "smtp_port_starttls": 1126,
        "smtp_login": resource.get("login"),
        "smtp_password": resource.get("password"),
        "mail_from": f"NewLevel CRM <crm@{DOMAIN}>",
        "resource_id": resource.get("id"),
        "dns_key": resource.get("dns_key"),
    }
    try:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        os.chmod(out, 0o600)
        print("Saved", out)
    except OSError as e:
        print("Could not write meta file:", e)
        print(json.dumps(meta, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dkim", help="DKIM TXT value from Selectel panel")
    parser.add_argument("--skip-dns", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    token = load_token()
    if args.dry_run:
        print("Token OK (dry-run)")
        return 0

    resource = get_or_create_resource(token)
    ses_id = resource["id"]
    dns_key = resource.get("dns_key", "")
    print("dns_key (domain verification):", dns_key)
    print("SMTP login:", resource.get("login"))

    if not args.skip_dns:
        zone = find_zone(token)
        if not zone:
            print(
                f"Зона DNS {DOMAIN} не найдена в Selectel DNS. "
                "Создайте зону в панели DNS или укажите NS Selectel.",
                file=sys.stderr,
            )
        else:
            zid = zone["id"]
            print("DNS zone:", zid)
            if dns_key:
                upsert_txt(token, zid, DOMAIN, dns_key, "Selectel SES domain verify", merge=True)
            ensure_spf(token, zid)
            upsert_txt(
                token,
                zid,
                f"_dmarc.{DOMAIN}",
                "v=DMARC1; p=quarantine;",
                "Selectel DMARC",
            )
            if args.dkim:
                upsert_txt(
                    token,
                    zid,
                    f"selcloud._domainkey.{DOMAIN}",
                    args.dkim,
                    "Selectel DKIM",
                )
            else:
                print(
                    "\nDKIM: скопируйте значение в панели SES для",
                    DOMAIN,
                    "и запустите:\n"
                    f"  python3 {__file__} --dkim '...'\n",
                )

    for attempt in range(5):
        link_domain(token, ses_id)
        code, doms = api("GET", f"{SES_BASE}/resources/{ses_id}/domains", token)
        if code == 200 and DOMAIN in doms.get("domains", []):
            break
        print(f"Link domain retry {attempt + 1}/5 in 30s...")
        time.sleep(30)

    print("\nWaiting 15s for DNS check...")
    time.sleep(15)
    ver = check_verification(token, ses_id)
    print("Verification:", json.dumps(ver, ensure_ascii=False))

    save_credentials(resource)
    print(
        "\nДальше на сервере:\n"
        "  bash /opt/pb-control/apply_selectel_smtp.sh\n"
        "И в Vercel (crm-new-level-v2): SMTP_HOST, SMTP_PORT=1127, SMTP_USER, SMTP_PASS, MAIL_FROM\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
