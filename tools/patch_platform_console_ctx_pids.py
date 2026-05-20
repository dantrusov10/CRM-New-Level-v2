#!/usr/bin/env python3
"""Insert context_product_ids into ai_insights create body (run on server)."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

PATH = Path("/opt/pb-control/platform-console/server.py")

OLD = """    ai_record = _tenant_api_create(
        tenant_pb_url,
        "ai_insights",
        {
            "deal_id": deal_id,
"""

NEW = """    _raw_pids = payload.get("product_ids") or payload.get("productIds") or (context or {}).get("product_ids") or (context or {}).get("productIds")
    _context_product_ids = []
    if isinstance(_raw_pids, list):
        _context_product_ids = [str(x).strip() for x in _raw_pids if str(x).strip()]
    elif isinstance(_raw_pids, str) and _raw_pids.strip():
        _context_product_ids = [s.strip() for s in _raw_pids.split(",") if s.strip()]

    ai_record = _tenant_api_create(
        tenant_pb_url,
        "ai_insights",
        {
            "deal_id": deal_id,
            "context_product_ids": _context_product_ids,
"""


def main() -> int:
    text = PATH.read_text(encoding="utf-8")
    if NEW in text:
        print("already patched")
        return 0
    if OLD not in text:
        print("pattern not found", file=sys.stderr)
        return 1
    bak = PATH.with_suffix(".py.bak_ctx_pids")
    shutil.copy(PATH, bak)
    PATH.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
    print("ok, backup:", bak)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
