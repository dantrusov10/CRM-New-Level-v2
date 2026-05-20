import type { Req, Res } from "./_lib/http";
import { header } from "./_lib/http";
import { pocketBaseUrl, servicePbToken } from "./_lib/pbAuth";
const EXPORT_GATEWAY =
  process.env.EXPORT_EMAIL_GATEWAY_URL ||
  "https://control.nwlvl.ru/owner/api/public/send-export-email";
import { runDealExportServer, shouldRunServerJob, serverRunKeyForNow } from "./_lib/exportServer";

type ExportJobRecord = {
  id: string;
  job_id?: string;
  enabled?: boolean;
  config_json?: {
    name?: string;
    entity?: string;
    format?: "xlsx" | "csv";
    fields?: Record<string, boolean>;
    emails?: string[];
    schedule?: { type: string; hour: number; minute: number; weekday?: number };
    pb_filter?: string;
    useCurrentFilters?: boolean;
  };
  last_run_key?: string;
};

export default async function handler(req: Req, res: Res) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = header(req, "authorization");
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }

  const token = servicePbToken();
  if (!token) {
    res.status(503).json({
      ok: false,
      error: "POCKETBASE_SERVICE_TOKEN not set — создайте admin-токен PB и добавьте на Vercel",
    });
    return;
  }

  const pb = pocketBaseUrl();
  const listRes = await fetch(`${pb}/collections/export_jobs/records?perPage=100&filter=enabled=true`, {
    headers: { Authorization: token },
  });

  if (listRes.status === 404) {
    res.status(200).json({
      ok: true,
      skipped: true,
      message: "Коллекция export_jobs не найдена в PocketBase — импортируйте pb_schema.json",
    });
    return;
  }

  if (!listRes.ok) {
    res.status(502).json({ ok: false, error: `PB list failed: ${listRes.status}` });
    return;
  }

  const list = (await listRes.json()) as { items?: ExportJobRecord[] };
  const jobs = list.items || [];
  const now = new Date();
  const results: Array<{ job_id: string; ok: boolean; detail?: string }> = [];

  for (const rec of jobs) {
    const cfg = rec.config_json || {};
    if (cfg.entity && cfg.entity !== "deal") {
      results.push({ job_id: rec.job_id || rec.id, ok: false, detail: "only_deal_supported_on_server" });
      continue;
    }
    const schedule = cfg.schedule || { type: "daily", hour: 9, minute: 0 };
    if (!shouldRunServerJob(schedule, rec.last_run_key, now)) {
      results.push({ job_id: rec.job_id || rec.id, ok: true, detail: "skipped_not_due" });
      continue;
    }

    const emails = (cfg.emails || []).filter(Boolean);
    if (!emails.length) {
      results.push({ job_id: rec.job_id || rec.id, ok: false, detail: "no_emails" });
      continue;
    }

    try {
      const file = await runDealExportServer({
        pbUrl: pb,
        token,
        fields: cfg.fields || { title: true, company: true, stage: true },
        pbFilter: cfg.pb_filter,
        format: cfg.format || "xlsx",
      });

      for (const to of emails) {
        const mailRes = await fetch(EXPORT_GATEWAY, {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            filename: file.filename,
            contentBase64: file.contentBase64,
            tenant_pb_url: pb,
          }),
        });
        const mailData = (await mailRes.json().catch(() => ({}))) as { ok?: boolean; error?: unknown };
        if (!mailRes.ok || !mailData.ok) throw new Error(String(mailData.error || mailRes.status));
      }

      const runKey = serverRunKeyForNow(now);
      await fetch(`${pb}/collections/export_jobs/records/${rec.id}`, {
        method: "PATCH",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ last_run_key: runKey, last_run_at: now.toISOString() }),
      });

      results.push({ job_id: rec.job_id || rec.id, ok: true, detail: `sent:${emails.join(",")}` });
    } catch (e) {
      results.push({
        job_id: rec.job_id || rec.id,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  res.status(200).json({ ok: true, checked: jobs.length, results });
}
