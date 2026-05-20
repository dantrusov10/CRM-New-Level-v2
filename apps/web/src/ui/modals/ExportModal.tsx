import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { humanizePbError } from "../../lib/pbError";
import { loadAutoExportJobs } from "../../lib/autoExport";
import { downloadExportResult, runExport, type TimelineExportFields } from "../../lib/exportRunner";
import { DEAL_EXPORT_COLUMNS, DEAL_EXPORT_DEFAULT_FIELDS } from "../../lib/dealImportExportFields";
import { AutoExportModal } from "./AutoExportModal";
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

const TIMELINE_FIELD_OPTS: Array<[keyof TimelineExportFields, string]> = [
  ["tl_comments", "Комментарии"],
  ["tl_notes", "Заметки"],
  ["tl_tasks", "Задачи (поставленные)"],
  ["tl_task_completed", "Задачи (выполненные)"],
  ["tl_task_status", "Статус задач"],
  ["tl_ai", "События ИИ"],
  ["tl_stage", "Изменения этапа"],
  ["tl_system", "Системные"],
];

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
  const [timelineFields, setTimelineFields] = React.useState<TimelineExportFields>({ tl_limit: 50 });
  const [openAutoExport, setOpenAutoExport] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const autoJobsCount = React.useMemo(() => loadAutoExportJobs().length, [open, openAutoExport]);

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

  async function exportNow() {
    const selectedFields = Object.values(fields).filter(Boolean).length;
    const selectedTimeline = Object.entries(timelineFields).some(([k, v]) => k !== "tl_limit" && v);
    if (!selectedFields && !(entity === "deal" && selectedTimeline)) {
      setStatus("Выберите хотя бы одно поле для экспорта");
      return;
    }

    setRunning(true);
    setStatus("Готовлю экспорт...");

    try {
      const result = await runExport({
        entity,
        format,
        fields,
        timelineFields: entity === "deal" ? timelineFields : undefined,
        useCurrentFilters,
        searchParams: sp,
      });
      downloadExportResult(result);
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
            {entity === "deal" ? (
              <div className="mt-4 grid gap-2 border-t border-border pt-3">
                <div className="text-sm font-semibold">Лента событий (лист timeline в Excel)</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text2 shrink-0">Событий на сделку:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="ui-input w-20 h-9"
                    value={timelineFields.tl_limit ?? 50}
                    onChange={(e) =>
                      setTimelineFields((tf) => ({
                        ...tf,
                        tl_limit: Math.max(1, Math.min(500, Number(e.target.value) || 50)),
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {TIMELINE_FIELD_OPTS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(timelineFields[key])}
                        onChange={() => setTimelineFields((tf) => ({ ...tf, [key]: !tf[key] }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-10 rounded-card border border-border bg-white px-3 text-sm"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Название пресета"
            />
            <Button variant="secondary" onClick={savePresetNow} disabled={!presetName.trim()}>
              Сохранить пресет
            </Button>
            <Button variant="secondary" onClick={() => setOpenAutoExport(true)}>
              {autoJobsCount ? "Настроить автоэкспорт" : "Автоэкспорт"}
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
      <AutoExportModal
        open={openAutoExport}
        onClose={() => setOpenAutoExport(false)}
        initialFields={fields}
        initialEntity={entity}
        initialFormat={format}
        initialUseFilters={useCurrentFilters}
      />
    </Modal>
  );
}
