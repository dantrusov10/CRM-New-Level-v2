import type { ExportFormat, ExportEntity, TimelineExportFields } from "./exportRunner";
import { pb } from "./pb";

export type AutoExportSchedule = {
  type: "daily" | "weekly";
  hour: number;
  minute: number;
  weekday?: number;
};

export type AutoExportJob = {
  id: string;
  name: string;
  enabled: boolean;
  entity: ExportEntity;
  format: ExportFormat;
  fields: Record<string, boolean>;
  timelineFields?: TimelineExportFields;
  useCurrentFilters: boolean;
  filterSnapshot: Record<string, string>;
  schedule: AutoExportSchedule;
  /** @deprecated используйте emails */
  email?: string;
  emails: string[];
  lastRunKey?: string;
  lastRunAt?: string;
};

function normalizeJob(raw: Record<string, unknown>): AutoExportJob {
  const emailsRaw = raw.emails;
  const legacyEmail = String(raw.email || "").trim();
  const emails = Array.isArray(emailsRaw)
    ? emailsRaw.map((x) => String(x).trim()).filter(Boolean)
    : legacyEmail
      ? [legacyEmail]
      : [];
  return { ...(raw as AutoExportJob), emails };
}

const LS_KEY = "reshenie_auto_export_v1";

export function loadAutoExportJobs(): AutoExportJob[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map((j) => normalizeJob(j as Record<string, unknown>)) : [];
  } catch {
    return [];
  }
}

export function saveAutoExportJobs(jobs: AutoExportJob[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0, 50)));
  void syncExportJobsToPb(jobs.slice(0, 50));
}

/** Синхронизация в PocketBase для серверного cron (коллекция export_jobs). */
export async function syncExportJobsToPb(jobs: AutoExportJob[]) {
  const user = pb.authStore.model as { id?: string } | null;
  if (!user?.id || !pb.authStore.token) return;
  let buildDealsFilter: ((sp: URLSearchParams) => string) | null = null;
  try {
    const m = await import("../ui/pages/deals/dealsFilters");
    buildDealsFilter = m.buildDealsFilter;
  } catch {
    return;
  }

  for (const job of jobs) {
    const sp = searchParamsFromSnapshot(job.filterSnapshot);
    const pb_filter = job.useCurrentFilters && buildDealsFilter ? buildDealsFilter(sp) : "";
    const config_json = { ...job, pb_filter };
    const payload = {
      job_id: job.id,
      name: job.name,
      enabled: job.enabled,
      owner_id: user.id,
      config_json,
      last_run_key: job.lastRunKey || "",
      last_run_at: job.lastRunAt || null,
    };
    try {
      const existing = await pb.collection("export_jobs").getList(1, 1, {
        filter: `job_id="${job.id.replace(/"/g, '\\"')}"`,
      });
      if (existing.items[0]) {
        await pb.collection("export_jobs").update(existing.items[0].id, payload);
      } else {
        await pb.collection("export_jobs").create(payload);
      }
    } catch {
      // коллекция export_jobs ещё не импортирована в PB
    }
  }
}

export function runKeyForNow(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}-${h}-${min}`;
}

/** Проверка: пора ли запускать (локальное время браузера). */
export function shouldRunAutoExport(job: AutoExportJob, now = new Date()): boolean {
  if (!job.enabled) return false;
  const { schedule } = job;
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
  if (schedule.type === "weekly" && now.getDay() !== (schedule.weekday ?? 1)) return false;
  const key = runKeyForNow(now);
  if (job.lastRunKey === key) return false;
  return true;
}

export function searchParamsFromSnapshot(snapshot: Record<string, string>): URLSearchParams {
  const sp = new URLSearchParams();
  Object.entries(snapshot).forEach(([k, v]) => {
    if (v?.trim()) sp.set(k, v.trim());
  });
  return sp;
}

export function snapshotFromSearchParams(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (v.trim()) out[k] = v;
  });
  return out;
}

/** Отправка: webhook (если задан) или скачивание + уведомление. */
export function autoExportWebhookUrl(): string {
  const custom = import.meta.env.VITE_AUTO_EXPORT_WEBHOOK?.trim();
  if (custom) return custom;
  const gateway = import.meta.env.VITE_AI_GATEWAY_URL?.trim();
  if (gateway) {
    const base = gateway.replace(/\/+$/, "");
    return `${base}/send-export-email`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/send-export-email`;
  }
  return "";
}

export function hasAutoExportWebhook(): boolean {
  return Boolean(autoExportWebhookUrl());
}

export async function deliverExportByEmail(
  emails: string[],
  blob: Blob,
  filename: string,
): Promise<{ sent: boolean; message: string }> {
  const list = emails.map((e) => e.trim()).filter(Boolean);
  const webhook = autoExportWebhookUrl();
  const token = pb.authStore.token || "";

  if (webhook && list.length && token) {
    try {
      const b64 = await blobToBase64(blob);
      const results = await Promise.all(
        list.map((to) =>
          fetch(webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
            body: JSON.stringify({
              to,
              filename,
              contentBase64: b64,
              tenant_pb_url: (import.meta.env.VITE_PB_URL as string) || "",
            }),
          }),
        ),
      );
      if (results.every((r) => r.ok)) {
        return { sent: true, message: `Отправлено на ${list.join(", ")}` };
      }
    } catch {
      // fallback below
    }
  }

  if (list.length) {
    const subject = encodeURIComponent(`CRM экспорт: ${filename}`);
    const body = encodeURIComponent(
      `Автовыгрузка CRM.\n\nФайл «${filename}» скачан в папку «Загрузки».\n\nАвтоотправка вложения по почте: ${hasAutoExportWebhook() ? "webhook настроен, но отправка не удалась" : "не настроена (нужен VITE_AUTO_EXPORT_WEBHOOK на сервере)"}.`,
    );
    window.open(`mailto:${list.join(",")}?subject=${subject}&body=${body}`, "_blank");
  }

  return {
    sent: false,
    message: list.length
      ? "Файл скачан. Для SMTP-вложений без ручного шага настройте VITE_AUTO_EXPORT_WEBHOOK."
      : "Файл скачан.",
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
