import * as XLSX from "xlsx";

type DealRow = Record<string, unknown> & {
  id?: string;
  title?: string;
  budget?: number;
  turnover?: number;
  current_score?: number;
  updated?: string;
  expand?: {
    company_id?: { name?: string; inn?: string };
    stage_id?: { stage_name?: string };
    responsible_id?: { name?: string; email?: string; full_name?: string };
  };
};

function cell(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function buildDealRow(d: DealRow, fields: Record<string, boolean>): Record<string, string> {
  const company = d.expand?.company_id;
  const stage = d.expand?.stage_id;
  const resp = d.expand?.responsible_id;
  const row: Record<string, string> = {};
  if (fields.title) row["Название сделки"] = cell(d.title);
  if (fields.company) row["Компания"] = cell(company?.name);
  if (fields.inn) row["ИНН"] = cell(company?.inn);
  if (fields.stage) row["Этап"] = cell(stage?.stage_name);
  if (fields.responsible) row["Ответственный"] = cell(resp?.full_name || resp?.name || resp?.email);
  if (fields.budget) row["Бюджет"] = cell(d.budget);
  if (fields.turnover) row["Оборот"] = cell(d.turnover);
  if (fields.current_score) row["AI скор"] = cell(d.current_score);
  if (fields.updated) row["Обновлено"] = cell(d.updated);
  return row;
}

export async function runDealExportServer(opts: {
  pbUrl: string;
  token: string;
  fields: Record<string, boolean>;
  pbFilter?: string;
  format: "xlsx" | "csv";
}): Promise<{ filename: string; contentBase64: string; mime: string }> {
  const params = new URLSearchParams({
    sort: "-updated",
    expand: "company_id,stage_id,responsible_id",
  });
  if (opts.pbFilter?.trim()) params.set("filter", opts.pbFilter.trim());

  const listUrl = `${opts.pbUrl.replace(/\/+$/, "")}/collections/deals/records?${params.toString()}&perPage=500`;
  const rows: DealRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 20) {
    const url = `${listUrl}&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: opts.token } });
    if (!res.ok) throw new Error(`PocketBase export failed: HTTP ${res.status}`);
    const data = (await res.json()) as { items?: DealRow[]; totalPages?: number };
    rows.push(...(data.items || []));
    totalPages = data.totalPages || 1;
    page += 1;
  }

  const sheetRows = rows.map((d) => buildDealRow(d, opts.fields));
  const ws = XLSX.utils.json_to_sheet(sheetRows.length ? sheetRows : [{ "": "" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Сделки");

  const stamp = new Date().toISOString().slice(0, 10);
  if (opts.format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const b64 = Buffer.from(csv, "utf-8").toString("base64");
    return { filename: `deals_${stamp}.csv`, contentBase64: b64, mime: "text/csv" };
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    filename: `deals_${stamp}.xlsx`,
    contentBase64: buf.toString("base64"),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export function shouldRunServerJob(
  schedule: { type: string; hour: number; minute: number; weekday?: number },
  lastRunKey: string | undefined,
  now = new Date(),
): boolean {
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
  if (schedule.type === "weekly" && now.getDay() !== (schedule.weekday ?? 1)) return false;
  const key = runKey(now);
  return lastRunKey !== key;
}

function runKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}-${h}-${min}`;
}

export { runKey as serverRunKeyForNow };
