import React from "react";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import Papa from "papaparse";
import { pb } from "../../lib/pb";

export function ImportExportPage() {
  return (
    <div className="grid gap-4">
      <ImportBlock />
      <ExportBlock />
    </div>
  );
}

function ExportBlock() {
  async function exportDeals() {
    const res = await pb.collection("deals").getList(1, 500, { sort: "-updated", expand: "company,stage,owner" });
    const rows = res.items.map((d: any) => ({
      id: d.id,
      name: d.name,
      company: d.expand?.company?.name ?? d.company ?? "",
      stage: d.expand?.stage?.name ?? d.stage ?? "",
      budget: d.budget ?? "",
      turnover: d.turnover ?? "",
      margin_percent: d.margin_percent ?? "",
      channel: d.channel ?? "",
      updated: d.updated ?? "",
    }));
    const csv = Papa.unparse(rows);
    download(csv, "deals.csv");
  }

  async function exportCompanies() {
    const res = await pb.collection("companies").getList(1, 500, { sort: "name" });
    const rows = res.items.map((c: any) => ({
      id: c.id,
      name: c.name,
      city: c.city ?? "",
      site: c.site ?? "",
      inn: c.inn ?? "",
      updated: c.updated ?? "",
    }));
    const csv = Papa.unparse(rows);
    download(csv, "companies.csv");
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Экспорт</div>
        <div className="text-xs text-text2 mt-1">CSV (MVP). В ТЗ также указан XLS/XLSX — можно добавить позже.</div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCompanies}>Экспорт компаний</Button>
          <Button variant="secondary" onClick={exportDeals}>Экспорт сделок</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportBlock() {
  const [log, setLog] = React.useState<string>("");

  async function importCsv(entity: "companies" | "deals", file: File) {
    setLog("Читаем файл...");
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];
    const errors: any[] = [];
    let ok = 0;

    const job = await pb.collection("import_jobs").create({
      entity_type: entity,
      mapping_json: { mode: "auto", headers: parsed.meta.fields },
      status: "running",
      created_at: new Date().toISOString(),
    }).catch(() => null);

    for (const [i, r] of rows.entries()) {
      try {
        if (entity === "companies") {
          if (!r.name) throw new Error("name required");
          await pb.collection("companies").create({
            name: r.name,
            city: r.city || undefined,
            site: r.site || undefined,
            inn: r.inn || undefined,
          });
        } else {
          if (!r.name) throw new Error("name required");
          await pb.collection("deals").create({
            name: r.name,
            budget: r.budget ? Number(r.budget) : undefined,
            turnover: r.turnover ? Number(r.turnover) : undefined,
            margin_percent: r.margin_percent ? Number(r.margin_percent) : undefined,
            channel: r.channel || undefined,
          });
        }
        ok++;
      } catch (e: any) {
        errors.push({ row: i + 2, error: e?.message ?? String(e), data: r });
      }
      setLog(`Импорт: ${ok}/${rows.length}...`);
    }

    if (job) {
      await pb.collection("import_jobs").update(job.id, {
        status: errors.length ? "finished_with_errors" : "done",
        finished_at: new Date().toISOString(),
        error_log: errors,
      }).catch(() => {});
    }
    setLog(errors.length ? `Готово: ${ok}/${rows.length}. Ошибок: ${errors.length}` : `Готово: ${ok}/${rows.length}.`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Импорт</div>
        <div className="text-xs text-text2 mt-1">CSV (MVP) + автосопоставление полей. Логи — `import_jobs`.</div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex gap-2 items-center">
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv("companies", f);
                }}
              />
              <Button variant="secondary">Импорт компаний (CSV)</Button>
            </label>

            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv("deals", f);
                }}
              />
              <Button variant="secondary">Импорт сделок (CSV)</Button>
            </label>
          </div>

          {log ? <div className="text-sm text-text2">{log}</div> : null}

          <div className="text-xs text-text2">
            Формат CSV для компаний: `name, city, site, inn`.<br />
            Формат CSV для сделок: `name, budget, turnover, margin_percent, channel`.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
