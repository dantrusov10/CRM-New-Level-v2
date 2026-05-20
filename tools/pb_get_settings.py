#!/usr/bin/env python3
import json, os, urllib.request
PB=os.environ["PB_URL"].rstrip("/")
body=json.dumps({"identity":os.environ["PB_ADMIN_EMAIL"],"password":os.environ["PB_ADMIN_PASSWORD"]}).encode()
req=urllib.request.Request(f"{PB}/api/admins/auth-with-password",data=body,headers={"Content-Type":"application/json"},method="POST")
with urllib.request.urlopen(req) as r:
    token=json.load(r)["token"]
req2=urllib.request.Request(f"{PB}/api/settings",headers={"Authorization":token})
with urllib.request.urlopen(req2) as r:
    print(json.dumps(json.load(r), indent=2, ensure_ascii=False)[:4000])
