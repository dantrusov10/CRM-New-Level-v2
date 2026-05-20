type SendParams = {
  to: string;
  subject: string;
  text: string;
  filename: string;
  contentBase64: string;
};

function mailFrom(): string {
  return (process.env.MAIL_FROM || "crm@nwlvl.ru").trim();
}

async function sendViaResend(p: SendParams): Promise<{ ok: boolean; error?: string }> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return { ok: false, error: "resend_not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [p.to],
      subject: p.subject,
      text: p.text,
      attachments: [{ filename: p.filename, content: p.contentBase64 }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 500) };
  }
  return { ok: true };
}

async function sendViaSmtp(p: SendParams): Promise<{ ok: boolean; error?: string }> {
  const host = (process.env.SMTP_HOST || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!host || !user || !pass) return { ok: false, error: "smtp_not_configured" };

  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== "false";

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transport.sendMail({
      from: mailFrom(),
      to: p.to,
      subject: p.subject,
      text: p.text,
      attachments: [
        {
          filename: p.filename,
          content: Buffer.from(p.contentBase64, "base64"),
        },
      ],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendExportAttachment(p: SendParams): Promise<{ ok: boolean; provider?: string; error?: string }> {
  if (process.env.RESEND_API_KEY) {
    const r = await sendViaResend(p);
    if (r.ok) return { ok: true, provider: "resend" };
  }

  const s = await sendViaSmtp(p);
  if (s.ok) return { ok: true, provider: "smtp" };

  return {
    ok: false,
    error:
      s.error ||
      "Настройте RESEND_API_KEY (рекомендуется для nwlvl.ru) или SMTP_HOST/SMTP_USER/SMTP_PASS на Vercel.",
  };
}
