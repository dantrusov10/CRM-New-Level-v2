import { pb } from "./pb";
import type { CustomReport } from "./reportBuilder";

const LS_KEY = "nwlvl_dashboard_custom_reports";

export function loadLocalReports(): CustomReport[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalReports(reports: CustomReport[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(reports.slice(0, 50)));
}

type PbSavedReport = {
  id: string;
  name?: string;
  source?: string;
  report_json?: CustomReport | null;
  layout_json?: Record<string, unknown> | null;
};

/** Load shared/personal reports from PocketBase; falls back to localStorage. */
export async function loadSavedReports(userId?: string): Promise<CustomReport[]> {
  const local = loadLocalReports();
  if (!userId) return local;
  try {
    const res = await pb.collection("saved_reports").getList(1, 50, {
      filter: `user_id="${userId.replace(/"/g, '\\"')}"`,
      sort: "-created",
    });
    const remote = (res.items as PbSavedReport[])
      .map((row) => {
        const cfg = row.report_json;
        if (!cfg || typeof cfg !== "object") return null;
        return {
          ...cfg,
          id: String(cfg.id || row.id),
          name: String(row.name || cfg.name || "Отчёт"),
          pbId: row.id,
        } as CustomReport;
      })
      .filter(Boolean) as CustomReport[];
    if (!remote.length) return local;
    // merge: remote wins by pbId/id, keep local-only
    const byId = new Map<string, CustomReport>();
    for (const r of local) byId.set(r.id, r);
    for (const r of remote) byId.set(r.id, r);
    const merged = Array.from(byId.values()).slice(0, 50);
    saveLocalReports(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function upsertSavedReport(userId: string | undefined, report: CustomReport): Promise<CustomReport> {
  const local = loadLocalReports();
  const nextLocal = [report, ...local.filter((x) => x.id !== report.id)].slice(0, 50);
  saveLocalReports(nextLocal);
  if (!userId) return report;
  try {
    const payload = {
      user_id: userId,
      name: report.name,
      source: report.source,
      report_json: report,
      created_at: new Date().toISOString(),
    };
    if (report.pbId) {
      await pb.collection("saved_reports").update(report.pbId, payload);
      return report;
    }
    const created = await pb.collection("saved_reports").create(payload);
    return { ...report, pbId: String(created.id) };
  } catch {
    return report;
  }
}

export async function deleteSavedReport(userId: string | undefined, report: CustomReport) {
  const local = loadLocalReports().filter((x) => x.id !== report.id);
  saveLocalReports(local);
  if (!userId || !report.pbId) return;
  try {
    await pb.collection("saved_reports").delete(report.pbId);
  } catch {
    // collection may be missing on tenant
  }
}
