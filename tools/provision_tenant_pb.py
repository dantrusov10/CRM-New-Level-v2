#!/usr/bin/env python3
"""
Provision an isolated PocketBase data directory for a new SaaS tenant.

- Imports schema from backend/pocketbase/collections.json (no business rows in that file).
- Creates superuser + one CRM `users` admin.
- Optionally applies backend/pocketbase/seed/tenant_default_records.json (воронка, роли,
  каналы, конструктор полей, парсеры, КП-шаблон, semantic_packs, kp_settings).

Requires: PocketBase CLI, Python 3.9+ (stdlib only).
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

_TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_TOOLS_DIR)
_DEFAULT_SEED = os.path.join(_REPO_ROOT, "backend", "pocketbase", "seed", "tenant_default_records.json")
_DEFAULT_EXPECT = os.path.join(_REPO_ROOT, "backend", "pocketbase", "seed", "expected_record_counts.json")


def _pick_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    _, port = s.getsockname()
    s.close()
    return int(port)


def _http_json(method: str, url: str, body: dict | None, token: str | None) -> tuple[int, dict | list | str]:
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            code = resp.getcode()
            if not raw:
                return code, {}
            return code, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed: dict | list | str = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = raw
        return int(e.code), parsed


def _wait_health(base: str, timeout_s: float = 45.0) -> None:
    deadline = time.time() + timeout_s
    url = f"{base.rstrip('/')}/api/health"
    last_err: str | None = None
    while time.time() < deadline:
        try:
            code, _ = _http_json("GET", url, None, None)
            if code == 200:
                return
        except Exception as ex:  # noqa: BLE001
            last_err = str(ex)
        time.sleep(0.25)
    raise RuntimeError(f"PocketBase did not become healthy at {url}. Last error: {last_err}")


def _superuser_auth(base: str, email: str, password: str) -> str:
    for path in ("/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"):
        code, body = _http_json(
            "POST",
            f"{base.rstrip('/')}{path}",
            {"identity": email, "password": password},
            None,
        )
        if code == 404:
            continue
        if code != 200:
            raise RuntimeError(f"Superuser auth failed ({path}): HTTP {code} {body}")
        if not isinstance(body, dict) or "token" not in body:
            raise RuntimeError(f"Superuser auth unexpected response: {body}")
        return str(body["token"])
    raise RuntimeError("Could not authenticate superuser (tried _superusers and admins endpoints).")


def _assert_schema_only(collections_json: str) -> None:
    with open(collections_json, encoding="utf-8") as f:
        root = json.load(f)
    if isinstance(root, dict) and any(k in root for k in ("records", "data")):
        raise SystemExit(
            f"Refusing to import {collections_json}: unexpected top-level keys "
            f"({', '.join(sorted(root.keys()))}). Use schema-only collections export."
        )
    if isinstance(root, dict) and "collections" not in root:
        raise SystemExit(f"{collections_json}: expected object with 'collections' array.")


def _prepare_seed_record(
    raw: dict,
    refs: dict[str, str],
    seed_dir: str,
) -> tuple[dict, str | None]:
    """Returns (body_for_post, ref_key_or_none)."""
    item = copy.deepcopy(raw)
    ref_key = item.pop("_ref", None)
    section_ref = item.pop("section_ref", None)
    if section_ref is not None:
        if section_ref not in refs:
            raise RuntimeError(f"Unknown section_ref {section_ref!r}; known refs: {sorted(refs)}")
        item["section_id"] = refs[section_ref]

    tpl_file = item.pop("template_json_file", None)
    if tpl_file:
        path = tpl_file if os.path.isabs(tpl_file) else os.path.join(seed_dir, tpl_file)
        with open(path, encoding="utf-8") as tf:
            item["template_json"] = json.load(tf)

    return item, ref_key if isinstance(ref_key, str) else None


def apply_tenant_seed(base: str, token: str, seed_json_path: str) -> None:
    seed_json_path = os.path.abspath(seed_json_path)
    seed_dir = os.path.dirname(seed_json_path)
    with open(seed_json_path, encoding="utf-8") as f:
        pack = json.load(f)
    steps = pack.get("steps")
    if not isinstance(steps, list):
        raise RuntimeError(f"{seed_json_path}: missing 'steps' array")

    refs: dict[str, str] = {}

    for step in steps:
        if not isinstance(step, dict):
            continue
        coll = step.get("collection")
        items = step.get("items")
        if not coll or not isinstance(items, list):
            raise RuntimeError(f"Invalid seed step: {step!r}")
        for raw in items:
            if not isinstance(raw, dict):
                raise RuntimeError(f"Seed item must be object in {coll}")
            body, ref_key = _prepare_seed_record(raw, refs, seed_dir)
            url = f"{base.rstrip('/')}/api/collections/{coll}/records"
            code, res = _http_json("POST", url, body, token)
            if code not in (200, 201):
                raise RuntimeError(f"Seed failed {coll}: HTTP {code} {res}")
            if not isinstance(res, dict) or "id" not in res:
                raise RuntimeError(f"Seed unexpected response for {coll}: {res}")
            if ref_key:
                refs[ref_key] = str(res["id"])

    if refs:
        print(f"OK: applied tenant seed ({seed_json_path}), refs resolved: {sorted(refs.keys())}")
    else:
        print(f"OK: applied tenant seed ({seed_json_path})")


def main() -> None:
    ap = argparse.ArgumentParser(description="Provision tenant PocketBase (schema + admin + default config seed).")
    ap.add_argument("--collections-json", required=True, help="Path to collections.json (schema only).")
    ap.add_argument("--pb-data-dir", required=True, help="Target pb_data directory (created or wiped with --force).")
    ap.add_argument("--pb-bin", default=os.environ.get("PB_BIN", "pb"), help="PocketBase binary path.")
    ap.add_argument("--admin-email", required=True)
    ap.add_argument("--admin-password", required=True)
    ap.add_argument("--admin-full-name", default="", help="Optional full_name on CRM users record.")
    ap.add_argument("--http-host", default="127.0.0.1")
    ap.add_argument("--http-port", type=int, default=0, help="0 = random free port.")
    ap.add_argument("--force", action="store_true", help="Delete existing pb_data if present.")
    ap.add_argument("--skip-verify", action="store_true", help="Skip post-verify script.")
    ap.add_argument("--no-seed", action="store_true", help="Do not apply tenant_default_records.")
    ap.add_argument(
        "--seed-json",
        default=_DEFAULT_SEED,
        help=f"Tenant seed steps JSON (default: {_DEFAULT_SEED})",
    )
    ap.add_argument(
        "--expect-json",
        default=_DEFAULT_EXPECT,
        help=f"Expected record counts for verify (default: {_DEFAULT_EXPECT})",
    )
    args = ap.parse_args()

    collections_json = os.path.abspath(args.collections_json)
    pb_data_dir = os.path.abspath(args.pb_data_dir)
    pb_bin = args.pb_bin

    _assert_schema_only(collections_json)

    if os.path.exists(pb_data_dir):
        if not args.force:
            raise SystemExit(f"Refusing to overwrite existing {pb_data_dir} (pass --force to delete).")
        shutil.rmtree(pb_data_dir)
    os.makedirs(pb_data_dir, mode=0o700, exist_ok=True)

    def run_pb(argv: list[str]) -> None:
        cmd = [pb_bin, *argv, "--dir", pb_data_dir]
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode != 0:
            raise SystemExit(f"Command failed ({' '.join(cmd)}):\n{p.stderr or p.stdout}")

    run_pb(["migrate", "collections", "import", collections_json])
    run_pb(["superuser", "upsert", args.admin_email, args.admin_password])

    port = args.http_port or _pick_port()
    base = f"http://{args.http_host}:{port}"
    proc = subprocess.Popen(
        [pb_bin, "serve", "--http", f"{args.http_host}:{port}", "--dir", pb_data_dir],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    seed_applied = False
    try:
        _wait_health(base)
        token = _superuser_auth(base, args.admin_email, args.admin_password)
        create_body = {
            "email": args.admin_email,
            "emailVisibility": True,
            "verified": True,
            "password": args.admin_password,
            "passwordConfirm": args.admin_password,
            "role": "admin",
            "full_name": args.admin_full_name or args.admin_email.split("@", 1)[0],
            "is_active": True,
        }
        code, body = _http_json("POST", f"{base}/api/collections/users/records", create_body, token)
        if code not in (200, 201):
            raise RuntimeError(f"Create CRM admin user failed: HTTP {code} {body}")

        if not args.no_seed:
            seed_path = os.path.abspath(args.seed_json)
            if os.path.isfile(seed_path):
                apply_tenant_seed(base, token, seed_path)
                seed_applied = True
            else:
                print(f"warning: seed file missing, skipped: {seed_path}", file=sys.stderr)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()

    if not args.skip_verify:
        verify = os.path.join(_TOOLS_DIR, "verify_tenant_pb_empty.py")
        if os.path.isfile(verify):
            cmd = [sys.executable, verify, "--pb-data-dir", pb_data_dir]
            exp = os.path.abspath(args.expect_json)
            if seed_applied and os.path.isfile(exp):
                cmd.extend(["--expect-json", exp])
            subprocess.run(cmd, check=True)
        else:
            print("warning: verify_tenant_pb_empty.py not found; skipped.", file=sys.stderr)

    print(f"OK: provisioned tenant at {pb_data_dir}")


if __name__ == "__main__":
    main()
