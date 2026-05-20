#!/usr/bin/env python3
import importlib.util
import json

spec = importlib.util.spec_from_file_location("s", "/opt/pb-control/setup_selectel_email.py")
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

tok = open("/opt/pb-control/.selectel_iam_token").read().strip()
zid = "1fd66b40-d7cb-40e0-88e1-eb7fc58f670f"
key = json.load(open("/opt/pb-control/.selectel_smtp_meta.json"))["dns_key"]
spf = "v=spf1 include:spf.mail.selcloud.ru ?all"

# apex: verify + SPF (two strings in one rrset)
apex = s.list_rrsets(tok, zid, "nwlvl.ru", "TXT")
records = [
    {"content": s.dns_txt_content(key), "disabled": False},
    {"content": s.dns_txt_content(spf), "disabled": False},
]
if apex:
    code, data = s.api(
        "PATCH",
        f"{s.DNS_BASE}/zones/{zid}/rrset/{apex[0]['id']}",
        tok,
        {"ttl": 300, "records": records, "comment": "SES verify + SPF"},
    )
    print("apex", code)
else:
    s.upsert_txt(tok, zid, "nwlvl.ru", key, "SES", merge=False)
    apex = s.list_rrsets(tok, zid, "nwlvl.ru", "TXT")
    if apex:
        s.api(
            "PATCH",
            f"{s.DNS_BASE}/zones/{zid}/rrset/{apex[0]['id']}",
            tok,
            {"ttl": 300, "records": records, "comment": "SES verify + SPF"},
        )

# _dmarc: only DMARC
dmarc = s.list_rrsets(tok, zid, "_dmarc.nwlvl.ru", "TXT")
if dmarc:
    s.api(
        "PATCH",
        f"{s.DNS_BASE}/zones/{zid}/rrset/{dmarc[0]['id']}",
        tok,
        {
            "ttl": 300,
            "records": [{"content": s.dns_txt_content("v=DMARC1; p=quarantine;"), "disabled": False}],
            "comment": "DMARC",
        },
    )
    print("dmarc fixed")

print("done")
