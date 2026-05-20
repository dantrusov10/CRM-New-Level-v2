"""SMTP export attachment delivery for CRM auto-export."""
from __future__ import annotations

import base64
import os
import re
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

MAIL_FROM = os.getenv("MAIL_FROM", "NewLevel CRM <crm@nwlvl.ru>")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.mail.selcloud.ru").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "1127"))
SMTP_USER = os.getenv("SMTP_USER", os.getenv("TENANT_PB_ADMIN_EMAIL", "")).strip()
def _smtp_password() -> str:
    direct = os.getenv("SMTP_PASS", "").strip()
    if direct:
        return direct
    path = os.getenv("SMTP_PASS_FILE", "/opt/pb-control/.smtp_app_password").strip()
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    return os.getenv("TENANT_PB_ADMIN_PASSWORD", "").strip()


SMTP_PASS = _smtp_password()
SMTP_SECURE = os.getenv("SMTP_SECURE", "true").lower() not in ("0", "false", "no")
DEFAULT_PB_URL = os.getenv("DEFAULT_TENANT_PB_URL", "https://pb.nwlvl.ru/api").rstrip("/")


def verify_tenant_user_token(token: str, pb_url: str | None = None) -> bool:
    t = (token or "").replace("Bearer ", "").strip()
    if not t:
        return False
    base = (pb_url or DEFAULT_PB_URL).rstrip("/")
    req = Request(
        f"{base}/collections/users/auth-refresh",
        method="POST",
        headers={"Authorization": t, "Content-Type": "application/json"},
        data=b"{}",
    )
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.status == 200
    except (HTTPError, URLError, TimeoutError):
        return False


def send_export_email(payload: dict) -> dict:
    to = str(payload.get("to", "")).strip()
    filename = str(payload.get("filename", "export.xlsx")).strip() or "export.xlsx"
    b64 = str(payload.get("contentBase64", "")).strip()
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", to):
        return {"ok": False, "error": "invalid_email"}
    if not b64:
        return {"ok": False, "error": "missing_attachment"}
    smtp_pass = _smtp_password()
    if not SMTP_HOST or not SMTP_USER or not smtp_pass:
        return {"ok": False, "error": "smtp_not_configured"}

    try:
        raw = base64.b64decode(b64)
    except Exception:
        return {"ok": False, "error": "invalid_base64"}

    msg = MIMEMultipart()
    msg["From"] = MAIL_FROM
    msg["To"] = to
    msg["Subject"] = f"CRM NewLevel — {filename}"
    msg["Reply-To"] = "crm@nwlvl.ru"
    msg.attach(MIMEText(f"Автовыгрузка CRM.\n\nВо вложении: {filename}\n", "plain", "utf-8"))
    part = MIMEApplication(raw, Name=filename)
    part["Content-Disposition"] = f'attachment; filename="{filename}"'
    msg.attach(part)

    try:
        if SMTP_SECURE:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=45) as smtp:
                smtp.login(SMTP_USER, smtp_pass)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=45) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(SMTP_USER, smtp_pass)
                smtp.send_message(msg)
    except Exception as e:
        return {"ok": False, "error": f"smtp_failed: {e}"}

    return {"ok": True, "provider": "smtp", "from": MAIL_FROM}
