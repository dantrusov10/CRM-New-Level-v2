#!/usr/bin/env python3
import importlib.util
import json

spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
zid = "1fd66b40-d7cb-40e0-88e1-eb7fc58f670f"
for rr in s.list_rrsets(tok, zid, "nwlvl.ru", "TXT"):
    print(json.dumps(rr, ensure_ascii=False, indent=2))
