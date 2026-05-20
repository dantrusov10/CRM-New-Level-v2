import type { ExportFormat, ExportEntity, TimelineExportFields } from "./exportRunner";

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
  email: string;
  lastRunKey?: string;
  lastRunAt?: string;
};

const LS_KEY = "reshenie_auto_export_v1";

export function loadAutoExportJobs(): AutoExportJob[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveAutoExportJobs(jobs: AutoExportJob[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0, 50)));
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
export async function deliverExportByEmail(
  email: string,
  blob: Blob,
  filename: string,
): Promise<{ sent: boolean; message: string }> {
  const webhook = import.meta.env.VITE_AUTO_EXPORT_WEBHOOK?.trim();
  if (webhook && email) {
    try {
      const b64 = await blobToBase64(blob);
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, filename, contentBase64: b64 }),
      });
      if (res.ok) return { sent: true, message: `Отправлено на ${email}` };
    } catch {
      // fallback below
    }
  }

  if (email) {
    const subject = encodeURIComponent(`CRM экспорт: ${filename}`);
    const body = encodeURIComponent(
      `Автовыгрузка CRM.\n\nФайл «${filename}» скачан в папку «Загрузки» на этом компьютере.\n\nДля полной автоотправки вложений настройте VITE_AUTO_EXPORT_WEBHOOK (SMTP на сервере).`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  }

  return {
    sent: false,
    message: email
      ? `Файл скачан. Письмо: проверьте черновик / вложите файл из «Загрузки».`
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
