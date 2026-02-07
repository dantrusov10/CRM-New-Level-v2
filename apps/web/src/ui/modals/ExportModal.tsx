import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { downloadCsv, downloadXlsx } from "../../lib/importExport";
import { pb } from "../../lib/pb";

type EntityType = "deal" | "company";
type Format = "xlsx" | "csv";

const LS_KEY = "reshenie_export_presets_v1";

type ExportPreset = {
  id: string;
  name: string;
  entity: EntityType;
  format: Format;
  fields: Record<string, boolean>;
  useCurrentFilters: boolean;
};

function safeText(v: string) {
  return v.replace(/"/g, "\\\"");
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

  const defaultFieldsDeals: Record<string, boolean> = React.useMemo(
    () => ({
      title: true,
      company: true,
      inn: false,
      stage: true,
      responsible: true,
      budget: true,
      turnover: true,
      margin_percent: true,
      discount_percent: false,
      sales_channel: true,
      partner: false,
      purchase_format: false,
      attraction_date: false,
      expected_payment_date: false,
      payment_received_date: false,
      updated: false,
    }),
    []
  );

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

  function buildDealsFilterFromUrl() {
    const stage = sp.get("stage") || "";
    const owner = sp.get("owner") || "";
    const channel = sp.get("channel") || "";
    const parts: string[] = [];
    if (stage) parts.push(`stage_id="${safeText(stage)}"`);
    if (owner) parts.push(`responsible_id="${safeText(owner)}"`);
    if (channel) parts.push(`sales_channel~"${safeText(channel)}"`);
    return parts.join(" && ");
  }

  function buildCompaniesFilterFromUrl() {
    const city = sp.get("city") || "";
    const responsible = sp.get("responsible") || "";
    const parts: string[] = [];
    if (city) parts.push(`city~"${safeText(city)}"`);
    if (responsible) parts.push(`responsible_id="${safeText(responsible)}"`);
    return parts.join(" && ");
  }

  async function fetchAll(collection: string, params: any) {
    const items: any[] = [];
    let page = 1;
    const perPage = 200;
    while (true) {
      const res = await pb.collection(collection).getList(page, perPage, params);
      items.push(...res.items);
      if (res.items.length < perPage) break;
      page++;
      if (page > 50) break; // safety
      setStatus(`Загружаю данные: ${items.length}...`);
    }
    return items;
  }

  async function exportNow() {
    setRunning(true);
    setStatus("Готовлю экспорт...");

    try {
      if (entity === "deal") {
        const filter = useCurrentFilters ? buildDealsFilterFromUrl() : "";
        const deals = await fetchAll("deals", {
          sort: "-updated",
          filter: filter || undefined,
          expand: "company_id,stage_id,responsible_id",
        });

        const rows = deals.map((d: any) => {
          const company = d.expand?.company_id;
          const stage = d.expand?.stage_id;
          const resp = d.expand?.responsible_id;
          const row: Record<string, any> = {};
          if (fields.title) row["Название сделки"] = d.title ?? "";
          if (fields.company) row["Компания"] = company?.name ?? "";
          if (fields.inn) row["ИНН"] = company?.inn ?? "";
          if (fields.stage) row["Этап"] = stage?.stage_name ?? "";
          if (fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
          if (fields.budget) row["Бюджет"] = d.budget ?? "";
          if (fields.turnover) row["Оборот"] = d.turnover ?? "";
          if (fields.margin_percent) row["Маржа, %"] = d.margin_percent ?? "";
          if (fields.discount_percent) row["Скидка, %"] = d.discount_percent ?? "";
          if (fields.sales_channel) row["Канал продаж"] = d.sales_channel ?? "";
          if (fields.partner) row["Партнёр"] = d.partner ?? "";
          if (fields.purchase_format) row["Формат закупки"] = d.purchase_format ?? "";
          if (fields.attraction_date) row["Дата привлечения"] = d.attraction_date ?? "";
          if (fields.expected_payment_date) row["Ожидаемая оплата"] = d.expected_payment_date ?? "";
          if (fields.payment_received_date) row["Фактическая оплата"] = d.payment_received_date ?? "";
          if (fields.updated) row["Обновлено"] = d.updated ?? "";
          return row;
        });

        if (format === "xlsx") downloadXlsx(rows, "deals", "deals_export.xlsx");
        else downloadCsv(rows, "deals_export.csv");
      } else {
        const filter = useCurrentFilters ? buildCompaniesFilterFromUrl() : "";
        const companies = await fetchAll("companies", {
          sort: "name",
          filter: filter || undefined,
          expand: "responsible_id",
        });

        const rows = companies.map((c: any) => {
          const resp = c.expand?.responsible_id;
          const row: Record<string, any> = {};
          if (fields.name) row["Название компании"] = c.name ?? "";
          if (fields.inn) row["ИНН"] = c.inn ?? "";
          if (fields.city) row["Город"] = c.city ?? "";
          if (fields.website) row["Сайт"] = c.website ?? "";
          if (fields.phone) row["Телефон"] = c.phone ?? "";
          if (fields.email) row["Email"] = c.email ?? "";
          if (fields.responsible) row["Ответственный"] = resp?.full_name || resp?.email || "";
          if (fields.updated) row["Обновлено"] = c.updated ?? "";
          return row;
        });

        if (format === "xlsx") downloadXlsx(rows, "companies", "companies_export.xlsx");
        else downloadCsv(rows, "companies_export.csv");
      }

      setStatus("Готово ✅");
    } catch (e: any) {
      setStatus(`Ошибка: ${e?.message ?? String(e)}`);
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
      return [
        ["title", "Название сделки"],
        ["company", "Компания"],
        ["inn", "ИНН"],
        ["stage", "Этап"],
        ["responsible", "Ответственный"],
        ["budget", "Бюджет"],
        ["turnover", "Оборот"],
        ["margin_percent", "Маржа, %"],
        ["discount_percent", "Скидка, %"],
        ["sales_channel", "Канал продаж"],
        ["partner", "Партнёр"],
        ["purchase_format", "Формат закупки"],
        ["attraction_date", "Дата привлечения"],
        ["expected_payment_date", "Ожидаемая оплата"],
        ["payment_received_date", "Фактическая оплата"],
        ["updated", "Обновлено"],
      ] as const;
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
      <div className="grid gap-4">
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

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Поля</div>
          <div className="grid grid-cols-2 gap-2">
            {fieldList.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(fields[k])} onChange={() => toggleField(k)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
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
