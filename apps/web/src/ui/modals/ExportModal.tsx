import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { downloadCsv, downloadXlsx } from "../../lib/importExport";
import { pb } from "../../lib/pb";
import { humanizePbError } from "../../lib/pbError";
import { DEAL_EXPORT_COLUMNS, DEAL_EXPORT_DEFAULT_FIELDS } from "../../lib/dealImportExportFields";
import { dealFieldLabel, normalizeDealFieldName } from "../../lib/canonicalFields";
import { enrichDealsNumericFields } from "../pages/deals/dealNumeric";
import { buildDealsFilter, filterDealsClient, hasClientNumericFilters } from "../pages/deals/dealsFilters";
import type { Company, Deal, UserSummary, FunnelStage } from "../../lib/types";

type EntityType = "deal" | "company";
type Format = "xlsx" | "csv";

const LS_KEY = "reshenie_export_presets_v1";


type DealExportRow = Deal & {
  expand?: {
    company_id?: Company | null;
    stage_id?: FunnelStage | null;
    responsible_id?: UserSummary | null;
  };
};
type CompanyExportRow = Company & {
  expand?: {
    responsible_id?: UserSummary | null;
  };
};

type ExportPreset = {
  id: string;
  name: string;
  entity: EntityType;
  format: Format;
  fields: Record<string, boolean>;
  useCurrentFilters: boolean;
};

function exportCell(val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function buildDealExportRow(d: DealExportRow, fields: Record<string, boolean>): Record<string, string> {
  const company = d.expand?.company_id;
  const stage = d.expand?.stage_id;
  const resp = d.expand?.responsible_id;
  const row: Record<string, string> = {};
  if (fields.title) row["Название сделки"] = d.title ?? "";
  if (fields.company) row["Компания"] = company?.name ?? "";
  if (fields.inn) row["ИНН"] = company?.inn ?? "";
  if (fields.stage) row["Этап"] = stage?.stage_name ?? "";
  if (fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
  for (const col of DEAL_EXPORT_COLUMNS) {
    if (!col.canonical || !fields[col.key]) continue;
    const canon = normalizeDealFieldName(col.canonical);
    if (!canon || ["title", "company_id", "stage_id", "responsible_id"].includes(canon)) continue;
    row[dealFieldLabel(canon)] = exportCell((d as Record<string, unknown>)[canon]);
  }
  if (fields.delivery_date) row["Поставка"] = exportCell((d as Record<string, unknown>).delivery_date);
  if (fields.expected_payment_date) row["Ожид. оплата"] = exportCell((d as Record<string, unknown>).expected_payment_date);
  if (fields.updated) row["Обновлено"] = exportCell(d.updated);
  return row;
}

function loadPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
  } catch {
    // ignore
  }
  return [];
}

function savePresets(presets: ExportPreset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(presets));
}

export function ExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [sp] = useSearchParams();

  const [entity, setEntity] = React.useState<EntityType>("deal");
  const [format, setFormat] = React.useState<Format>("xlsx");
  const [useCurrentFilters, setUseCurrentFilters] = React.useState(true);
  const [presetName, setPresetName] = React.useState("");
  const [presets, setPresets] = React.useState<ExportPreset[]>([]);

  const [fields, setFields] = React.useState<Record<string, boolean>>({});
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;
    setPresets(loadPresets());
    setPresetName("");
    setRunning(false);
    setStatus("");
    setEntity("deal");
    setFormat("xlsx");
    setUseCurrentFilters(true);
    setFields({});
  }, [open]);

  const defaultFieldsDeals: Record<string, boolean> = React.useMemo(() => ({ ...DEAL_EXPORT_DEFAULT_FIELDS }), []);

  const defaultFieldsCompanies: Record<string, boolean> = React.useMemo(
    () => ({
      name: true,
      inn: true,
      city: true,
      website: true,
      phone: false,
      email: false,
      responsible: true,
      updated: false,
    }),
    []
  );

  React.useEffect(() => {
    if (!open) return;
    if (Object.keys(fields).length) return;
    setFields(entity === "deal" ? defaultFieldsDeals : defaultFieldsCompanies);
  }, [open, entity, fields, defaultFieldsDeals, defaultFieldsCompanies]);

  function buildCompaniesFilterFromUrl() {
    const city = sp.get("city") || "";
    const responsible = sp.get("responsible") || "";
    const parts: string[] = [];
    if (city) parts.push(`city~"${city.replace(/"/g, '\\"')}"`);
    if (responsible) parts.push(`responsible_id="${responsible.replace(/"/g, '\\"')}"`);
    return parts.join(" && ");
  }

  async function fetchDealsForExport(): Promise<DealExportRow[]> {
    const filter = useCurrentFilters ? buildDealsFilter(sp) : "";
    const params: Record<string, unknown> = {
      sort: "-updated",
      expand: "company_id,stage_id,responsible_id",
      batch: 200,
    };
    if (filter.trim()) params.filter = filter.trim();
    setStatus("Загружаю сделки...");
    let deals = await pb.collection("deals").getFullList<DealExportRow>(params);
    deals = await enrichDealsNumericFields(deals);
    if (useCurrentFilters && hasClientNumericFilters(sp)) {
      deals = filterDealsClient(deals, sp);
    }
    return deals;
  }

  async function fetchCompaniesForExport(): Promise<CompanyExportRow[]> {
    const filter = useCurrentFilters ? buildCompaniesFilterFromUrl() : "";
    const params: Record<string, unknown> = {
      sort: "name",
      expand: "responsible_id",
      batch: 200,
    };
    if (filter.trim()) params.filter = filter.trim();
    setStatus("Загружаю компании...");
    return pb.collection("companies").getFullList<CompanyExportRow>(params);
  }

  async function exportNow() {
    const selectedFields = Object.values(fields).filter(Boolean).length;
    if (!selectedFields) {
      setStatus("Выберите хотя бы одно поле для экспорта");
      return;
    }

    setRunning(true);
    setStatus("Готовлю экспорт...");

    try {
      if (entity === "deal") {
        const deals = await fetchDealsForExport();
        const rows = deals.map((d) => buildDealExportRow(d, fields));
        if (!rows.length) {
          setStatus("Нет сделок для экспорта по выбранным фильтрам");
          return;
        }
        if (format === "xlsx") downloadXlsx(rows, "deals", "deals_export.xlsx");
        else downloadCsv(rows, "deals_export.csv");
      } else {
        const companies = await fetchCompaniesForExport();

        const rows = companies.map((c) => {
          const resp = c.expand?.responsible_id;
          const row: Record<string, string> = {};
          if (fields.name) row["Название компании"] = c.name ?? "";
          if (fields.inn) row["ИНН"] = c.inn ?? "";
          if (fields.city) row["Город"] = c.city ?? "";
          if (fields.website) row["Сайт"] = c.website ?? "";
          if (fields.phone) row["Телефон"] = c.phone ?? "";
          if (fields.email) row["Email"] = c.email ?? "";
          if (fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
          if (fields.updated) row["Обновлено"] = exportCell(c.updated);
          return row;
        });
        if (!rows.length) {
          setStatus("Нет компаний для экспорта по выбранным фильтрам");
          return;
        }

        if (format === "xlsx") downloadXlsx(rows, "companies", "companies_export.xlsx");
        else downloadCsv(rows, "companies_export.csv");
      }

      setStatus("Готово ✅");
    } catch (e: unknown) {
      setStatus(`Ошибка: ${humanizePbError(e)}`);
    } finally {
      setRunning(false);
    }
  }

  function toggleField(k: string) {
    setFields((f) => ({ ...f, [k]: !f[k] }));
  }

  function savePresetNow() {
    if (!presetName.trim()) return;
    const p: ExportPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      entity,
      format,
      fields,
      useCurrentFilters,
    };
    const next = [p, ...presets].slice(0, 30);
    setPresets(next);
    savePresets(next);
    setPresetName("");
  }

  function applyPreset(p: ExportPreset) {
    setEntity(p.entity);
    setFormat(p.format);
    setFields(p.fields);
    setUseCurrentFilters(p.useCurrentFilters);
  }

  function deletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  }

  const filterSummary = React.useMemo(() => {
    if (!useCurrentFilters) return "Фильтры не учитываются";
    if (entity === "deal") {
      const stage = sp.get("stage");
      const owner = sp.get("owner");
      const channel = sp.get("channel");
      const parts: string[] = [];
      if (stage) parts.push("этап");
      if (owner) parts.push("ответственный");
      if (channel) parts.push("канал");
      return parts.length ? `Учитываются фильтры: ${parts.join(", ")}` : "Фильтры не заданы";
    }
    const city = sp.get("city");
    const responsible = sp.get("responsible");
    const parts: string[] = [];
    if (responsible) parts.push("ответственный");
    if (city) parts.push("город");
    return parts.length ? `Учитываются фильтры: ${parts.join(", ")}` : "Фильтры не заданы";
  }, [useCurrentFilters, entity, sp]);

  const fieldList = React.useMemo(() => {
    if (entity === "deal") {
      return DEAL_EXPORT_COLUMNS.map((c) => [c.key, c.label] as const);
    }
    return [
      ["name", "Название компании"],
      ["inn", "ИНН"],
      ["city", "Город"],
      ["website", "Сайт"],
      ["phone", "Телефон"],
      ["email", "Email"],
      ["responsible", "Ответственный"],
      ["updated", "Обновлено"],
    ] as const;
  }, [entity]);

  return (
    <Modal open={open} title="Экспорт" onClose={onClose} widthClass="max-w-3xl">
      <div className="grid max-h-[min(78vh,720px)] grid-rows-[auto_auto_auto_auto_1fr_auto_auto] gap-4">
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Что экспортируем</div>
          <div className="flex gap-2">
            <Button variant={entity === "deal" ? "primary" : "secondary"} onClick={() => setEntity("deal")}>Сделки</Button>
            <Button variant={entity === "company" ? "primary" : "secondary"} onClick={() => setEntity("company")}>Компании</Button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Фильтры</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useCurrentFilters} onChange={(e) => setUseCurrentFilters(e.target.checked)} />
            Экспортировать текущий список (с учётом фильтров)
          </label>
          <div className="text-xs text-text2">{filterSummary}</div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Формат</div>
          <div className="flex gap-2">
            <Button variant={format === "xlsx" ? "primary" : "secondary"} onClick={() => setFormat("xlsx")}>Excel (.xlsx)</Button>
            <Button variant={format === "csv" ? "primary" : "secondary"} onClick={() => setFormat("csv")}>CSV</Button>
          </div>
        </div>

        <div className="grid min-h-0 gap-2 overflow-hidden">
          <div className="text-sm font-semibold">Поля</div>
          <div className="crm-scrollbar min-h-0 max-h-[min(36vh,280px)] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {fieldList.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(fields[k])} onChange={() => toggleField(k)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              className="h-10 rounded-card border border-border bg-white px-3 text-sm"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Название пресета"
            />
            <Button variant="secondary" onClick={savePresetNow} disabled={!presetName.trim()}>
              Сохранить пресет
            </Button>
          </div>
          <Button onClick={exportNow} disabled={running}>
            {running ? "Экспорт..." : "Экспортировать"}
          </Button>
        </div>

        {status ? <div className="text-sm text-text2">{status}</div> : null}

        {presets.length ? (
          <div className="grid gap-2">
            <div className="text-sm font-semibold">Сохранённые пресеты (локально)</div>
            <div className="border border-border rounded-card overflow-hidden">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
                  <button type="button" className="text-sm font-medium hover:underline" onClick={() => applyPreset(p)}>
                    {p.name}
                    <span className="text-xs text-text2"> · {p.entity === "deal" ? "Сделки" : "Компании"}</span>
                  </button>
                  <button type="button" className="text-xs text-text2 hover:text-danger" onClick={() => deletePreset(p.id)}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
