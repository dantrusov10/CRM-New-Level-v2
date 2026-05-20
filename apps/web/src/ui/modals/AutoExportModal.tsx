import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  type AutoExportJob,
  hasAutoExportWebhook,
  loadAutoExportJobs,
  saveAutoExportJobs,
  snapshotFromSearchParams,
} from "../../lib/autoExport";
import { DEAL_EXPORT_COLUMNS } from "../../lib/dealImportExportFields";
import type { TimelineExportFields } from "../../lib/exportRunner";

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

const WEEKDAYS = [
  [0, "Вс"],
  [1, "Пн"],
  [2, "Вт"],
  [3, "Ср"],
  [4, "Чт"],
  [5, "Пт"],
  [6, "Сб"],
] as const;

function newJobTemplate(
  sp: URLSearchParams,
  initial?: {
    fields?: Record<string, boolean>;
    entity?: "deal" | "company";
    format?: "xlsx" | "csv";
    useCurrentFilters?: boolean;
  },
): AutoExportJob {
  return {
    id: crypto.randomUUID(),
    name: "Новая автовыгрузка",
    enabled: true,
    entity: initial?.entity ?? "deal",
    format: initial?.format ?? "xlsx",
    fields: initial?.fields ?? Object.fromEntries(DEAL_EXPORT_COLUMNS.map((c) => [c.key, false])),
    timelineFields: { tl_limit: 50 },
    useCurrentFilters: initial?.useCurrentFilters ?? true,
    filterSnapshot: snapshotFromSearchParams(sp),
    schedule: { type: "daily", hour: 9, minute: 0, weekday: 1 },
    emails: [],
  };
}

export function AutoExportModal({
  open,
  onClose,
  initialFields,
  initialEntity,
  initialFormat,
  initialUseFilters,
}: {
  open: boolean;
  onClose: () => void;
  initialFields?: Record<string, boolean>;
  initialEntity?: "deal" | "company";
  initialFormat?: "xlsx" | "csv";
  initialUseFilters?: boolean;
}) {
  const [sp] = useSearchParams();
  const [jobs, setJobs] = React.useState<AutoExportJob[]>([]);
  const [mode, setMode] = React.useState<"list" | "edit">("list");
  const [editing, setEditing] = React.useState<AutoExportJob | null>(null);
  const [emailDraft, setEmailDraft] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setJobs(loadAutoExportJobs());
    setMode("list");
    setEditing(null);
    setEmailDraft("");
  }, [open]);

  function persist(job: AutoExportJob) {
    const next = jobs.some((j) => j.id === job.id) ? jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...jobs];
    setJobs(next);
    saveAutoExportJobs(next);
    setMode("list");
    setEditing(null);
    setEmailDraft("");
  }

  function removeJob(id: string) {
    const next = jobs.filter((j) => j.id !== id);
    setJobs(next);
    saveAutoExportJobs(next);
  }

  function startNewJob() {
    setEditing(
      newJobTemplate(sp, {
        fields: initialFields,
        entity: initialEntity,
        format: initialFormat,
        useCurrentFilters: initialUseFilters,
      }),
    );
    setMode("edit");
  }

  if (!open) return null;

  if (mode === "list") {
    return (
      <Modal open={open} title="Настроить автоэкспорт" onClose={onClose} widthClass="max-w-2xl">
        <div className="grid gap-3">
          <p className="text-sm text-text2">
            Расписание — по времени этого компьютера. Выгрузка срабатывает, пока открыта вкладка CRM.
          </p>
          {jobs.length ? (
            <div className="grid gap-2">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className="rounded-card border border-border bg-rowHover/60 p-3 text-left hover:border-primary/50"
                  onClick={() => {
                    setEditing(j);
                    setMode("edit");
                  }}
                >
                  <div className="font-medium text-sm">{j.name}</div>
                  <div className="text-xs text-text2 mt-1">
                    {j.entity === "deal" ? "Сделки" : "Компании"} · {j.format.toUpperCase()} ·{" "}
                    {j.enabled ? "вкл" : "выкл"} ·{" "}
                    {j.schedule.type === "daily"
                      ? `ежедневно ${String(j.schedule.hour).padStart(2, "0")}:${String(j.schedule.minute).padStart(2, "0")}`
                      : `еженедельно ${WEEKDAYS.find(([d]) => d === j.schedule.weekday)?.[1] ?? "Пн"} ${String(j.schedule.hour).padStart(2, "0")}:${String(j.schedule.minute).padStart(2, "0")}`}
                    {j.emails?.length ? ` · ${j.emails.join(", ")}` : ""}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text2">Автовыгрузок пока нет. Создайте первую.</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
            <Button onClick={startNewJob}>Создать новую</Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!editing) return null;

  const tf = editing.timelineFields ?? { tl_limit: 50 };
  const dealFieldKeys = DEAL_EXPORT_COLUMNS.map((c) => c.key);
  const webhookOn = hasAutoExportWebhook();

  return (
    <Modal
      open={open}
      title={jobs.some((j) => j.id === editing.id) ? "Редактировать автоэкспорт" : "Новая автовыгрузка"}
      onClose={onClose}
      widthClass="max-w-3xl"
    >
      <div className="grid gap-4 max-h-[min(78vh,720px)] overflow-y-auto crm-scrollbar pr-1">
        <div>
          <div className="text-xs text-text2 mb-1">Название</div>
          <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </div>

        <div>
          <div className="text-xs text-text2 mb-1">Email для выгрузки</div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="manager@company.ru"
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const e = emailDraft.trim();
                if (!e || !e.includes("@")) return;
                if (editing.emails.includes(e)) return;
                setEditing({ ...editing, emails: [...editing.emails, e] });
                setEmailDraft("");
              }}
            >
              Добавить
            </Button>
          </div>
          {editing.emails.length ? (
            <ul className="mt-2 grid gap-1.5">
              {editing.emails.map((em) => (
                <li key={em} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm">
                  <span>{em}</span>
                  <button
                    type="button"
                    className="text-xs text-danger hover:underline"
                    onClick={() => setEditing({ ...editing, emails: editing.emails.filter((x) => x !== em) })}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-xs text-text2">Добавьте один или несколько адресов.</div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={editing.enabled}
            onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
          />
          Включено
        </label>

        <div className="flex flex-wrap gap-2">
          <Button variant={editing.entity === "deal" ? "primary" : "secondary"} onClick={() => setEditing({ ...editing, entity: "deal" })}>
            Сделки
          </Button>
          <Button variant={editing.entity === "company" ? "primary" : "secondary"} onClick={() => setEditing({ ...editing, entity: "company" })}>
            Компании
          </Button>
          <Button variant={editing.format === "xlsx" ? "primary" : "secondary"} onClick={() => setEditing({ ...editing, format: "xlsx" })}>
            Excel
          </Button>
          <Button variant={editing.format === "csv" ? "primary" : "secondary"} onClick={() => setEditing({ ...editing, format: "csv" })}>
            CSV
          </Button>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Расписание (локальное время ПК)</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={editing.schedule.type === "daily" ? "primary" : "secondary"}
              onClick={() => setEditing({ ...editing, schedule: { ...editing.schedule, type: "daily" } })}
            >
              Ежедневно
            </Button>
            <Button
              variant={editing.schedule.type === "weekly" ? "primary" : "secondary"}
              onClick={() =>
                setEditing({ ...editing, schedule: { ...editing.schedule, type: "weekly", weekday: editing.schedule.weekday ?? 1 } })
              }
            >
              Еженедельно
            </Button>
          </div>
          {editing.schedule.type === "weekly" ? (
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  className={`ui-btn h-8 px-2 text-xs ${editing.schedule.weekday === d ? "ui-btn-primary" : "ui-btn-secondary"}`}
                  onClick={() => setEditing({ ...editing, schedule: { ...editing.schedule, weekday: d } })}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={23}
              className="w-20"
              value={editing.schedule.hour}
              onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, hour: Number(e.target.value) } })}
            />
            <span>:</span>
            <Input
              type="number"
              min={0}
              max={59}
              className="w-20"
              value={editing.schedule.minute}
              onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, minute: Number(e.target.value) } })}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={editing.useCurrentFilters}
            onChange={(e) =>
              setEditing({
                ...editing,
                useCurrentFilters: e.target.checked,
                filterSnapshot: e.target.checked ? snapshotFromSearchParams(sp) : editing.filterSnapshot,
              })
            }
          />
          Сохранить текущие фильтры списка
        </label>

        {editing.entity === "deal" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Поля сделки</div>
              <div className="flex gap-2">
                <Button
                  small
                  variant="secondary"
                  onClick={() => setEditing({ ...editing, fields: Object.fromEntries(dealFieldKeys.map((k) => [k, true])) })}
                >
                  Выбрать все
                </Button>
                <Button
                  small
                  variant="secondary"
                  onClick={() => setEditing({ ...editing, fields: Object.fromEntries(dealFieldKeys.map((k) => [k, false])) })}
                >
                  Сбросить все
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto crm-scrollbar">
              {DEAL_EXPORT_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.fields[c.key])}
                    onChange={() => setEditing({ ...editing, fields: { ...editing.fields, [c.key]: !editing.fields[c.key] } })}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Лента событий</div>
              <div className="flex gap-2">
                <Button
                  small
                  variant="secondary"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      timelineFields: {
                        ...tf,
                        tl_limit: tf.tl_limit ?? 50,
                        ...Object.fromEntries(TIMELINE_FIELD_OPTS.map(([k]) => [k, true])),
                      },
                    })
                  }
                >
                  Выбрать все
                </Button>
                <Button
                  small
                  variant="secondary"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      timelineFields: { tl_limit: tf.tl_limit ?? 50 },
                    })
                  }
                >
                  Сбросить все
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text2">Событий на сделку:</span>
              <Input
                type="number"
                min={1}
                max={500}
                className="w-24"
                value={tf.tl_limit ?? 50}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    timelineFields: { ...tf, tl_limit: Math.max(1, Math.min(500, Number(e.target.value) || 50)) },
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIMELINE_FIELD_OPTS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(tf[key])}
                    onChange={() => setEditing({ ...editing, timelineFields: { ...tf, [key]: !tf[key] } })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </>
        ) : null}

        <p className="text-xs text-text2">
          {webhookOn
            ? "SMTP webhook настроен (VITE_AUTO_EXPORT_WEBHOOK): письма с вложением отправляются автоматически."
            : "Автоотправка вложений по почте не настроена: задайте VITE_AUTO_EXPORT_WEBHOOK на сервере. Сейчас файл скачивается локально."}
        </p>

        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setMode("list"); setEditing(null); }}>
              К списку
            </Button>
            {jobs.some((j) => j.id === editing.id) ? (
              <Button variant="secondary" onClick={() => removeJob(editing.id)}>
                Удалить
              </Button>
            ) : null}
          </div>
          <Button
            onClick={() => {
              persist({
                ...editing,
                filterSnapshot: editing.useCurrentFilters ? snapshotFromSearchParams(sp) : editing.filterSnapshot,
              });
            }}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
