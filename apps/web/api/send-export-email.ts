import type { Req, Res } from "./_lib/http";
import { header, readJsonBody } from "./_lib/http";
import { verifyPbUserToken } from "./_lib/pbAuth";
import { sendExportAttachment } from "./_lib/mail";

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const auth = await verifyPbUserToken(header(req, "authorization"));
  if (!auth.ok) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const body = readJsonBody(req);
  const to = String(body.to || "").trim();
  const filename = String(body.filename || "export.xlsx").trim() || "export.xlsx";
  const contentBase64 = String(body.contentBase64 || "").trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ ok: false, error: "invalid_email" });
    return;
  }
  if (!contentBase64) {
    res.status(400).json({ ok: false, error: "missing_attachment" });
    return;
  }

  const sent = await sendExportAttachment({
    to,
    filename,
    contentBase64,
    subject: `CRM NewLevel — ${filename}`,
    text: `Автовыгрузка CRM (nwlvl.ru).\n\nВо вложении: ${filename}.\n\nОтправитель: ${process.env.MAIL_FROM || "crm@nwlvl.ru"}`,
  });

  if (!sent.ok) {
    res.status(503).json({ ok: false, error: sent.error });
    return;
  }

  res.status(200).json({ ok: true, provider: sent.provider });
}
