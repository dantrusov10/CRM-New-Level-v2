type Target = { name: string; url: string };

type Req = { headers: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

async function ping(url: string, timeoutMs = 12_000): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers: { "User-Agent": "nwlvl-monitor/1.0" } });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: "telegram_not_configured" };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  return { sent: res.ok, status: res.status };
}

export default async function handler(req: Req, res: Res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }

  const appUrl = process.env.MONITOR_APP_URL || "https://app.nwlvl.ru";
  const targets: Target[] = [
    { name: "crm_frontend", url: appUrl },
    { name: "pocketbase", url: process.env.MONITOR_PB_URL || `${appUrl.replace(/\/+$/, "")}/api/health` },
    { name: "ai_gateway", url: process.env.MONITOR_AI_URL || "https://control.nwlvl.ru/owner/api/public/health" },
  ];

  const results = await Promise.all(
    targets.map(async (t) => {
      const r = await ping(t.url);
      return { ...t, ...r };
    }),
  );

  const failed = results.filter((r) => !r.ok);
  let telegram: { sent?: boolean; reason?: string; status?: number } = {};
  if (failed.length) {
    const lines = failed.map((f) => `• ${f.name}: ${f.url}\n  status=${f.status ?? "—"} err=${f.error ?? "HTTP fail"}`);
    const msg = `🚨 NewLevel CRM — падение сервиса\n\n${lines.join("\n")}\n\n${new Date().toISOString()}`;
    telegram = await sendTelegram(msg);
  }

  res.status(failed.length ? 503 : 200).json({
    ok: failed.length === 0,
    checked_at: new Date().toISOString(),
    results,
    telegram,
  });
}
