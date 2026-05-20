import React from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { documentTypeLabel, getTemplateDocumentType } from "./kpDocumentMeta";
import type { KpDocumentType, KpTemplateRecord } from "./types";

type ModalMode = null | { kind: "create"; docType: KpDocumentType } | { kind: "rename"; id: string; name: string };

export function KpTemplateSwitcher({
  templates,
  activeId,
  onEdit,
  onCreate,
  onRename,
  onDelete,
  busy,
}: {
  templates: KpTemplateRecord[];
  activeId: string | null;
  onEdit: (id: string) => void;
  onCreate: (type: KpDocumentType, name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy?: boolean;
}) {
  const [modal, setModal] = React.useState<ModalMode>(null);
  const [nameDraft, setNameDraft] = React.useState("");
  const [error, setError] = React.useState("");

  function openCreate(type: KpDocumentType) {
    const suffix = templates.filter((t) => getTemplateDocumentType(t) === type).length + 1;
    setNameDraft(
      type === "tkp"
        ? suffix > 1
          ? `ТКП — шаблон ${suffix}`
          : "ТКП — Стандарт"
        : suffix > 1
          ? `КП — шаблон ${suffix}`
          : "КП — Стандарт",
    );
    setError("");
    setModal({ kind: "create", docType: type });
  }

  function openRename(t: KpTemplateRecord) {
    setNameDraft(t.name || "");
    setError("");
    setModal({ kind: "rename", id: t.id, name: t.name || "" });
  }

  async function submitModal() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError("Введите название шаблона");
      return;
    }
    setError("");
    try {
      if (modal?.kind === "create") {
        await onCreate(modal.docType, trimmed);
      } else if (modal?.kind === "rename") {
        await onRename(modal.id, trimmed);
      }
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }

  return (
    <>
      <div className="rounded-card border border-border bg-rowHover p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-xs font-bold uppercase text-primary">Шаблоны документов</div>
            <div className="text-[11px] text-text2 mt-0.5">
              Выберите шаблон для редактирования ниже. Можно создать несколько КП и ТКП.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button small variant="secondary" disabled={busy} onClick={() => openCreate("kp")}>
              <Plus size={14} className="mr-1" />
              Новый КП
            </Button>
            <Button small variant="secondary" disabled={busy} onClick={() => openCreate("tkp")}>
              <Plus size={14} className="mr-1" />
              Новый ТКП
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {templates.map((t) => {
            const type = getTemplateDocumentType(t);
            const active = t.id === activeId;
            return (
              <div
                key={t.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-card border p-3 transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border bg-white"
                }`}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                  onClick={() => onEdit(t.id)}
                >
                  <FileText size={18} className="shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge>{documentTypeLabel(type)}</Badge>
                      {t.is_default ? <Badge>по умолчанию</Badge> : null}
                      {active ? <span className="text-[10px] text-primary font-semibold">редактируется</span> : null}
                    </span>
                    <span className="block text-sm font-semibold truncate mt-0.5">{t.name || "Без названия"}</span>
                  </span>
                </button>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    small
                    variant={active ? "primary" : "secondary"}
                    disabled={busy}
                    onClick={() => onEdit(t.id)}
                    title="Открыть редактор оформления и разделов PDF"
                  >
                    <Pencil size={14} className="mr-1" />
                    Редактировать
                  </Button>
                  <Button small variant="secondary" disabled={busy} onClick={() => openRename(t)} title="Переименовать">
                    Название
                  </Button>
                  <Button
                    small
                    variant="secondary"
                    disabled={busy || templates.length <= 1}
                    onClick={() => void onDelete(t.id)}
                    title={templates.length <= 1 ? "Нельзя удалить последний шаблон" : "Удалить"}
                  >
                    <Trash2 size={14} className="text-danger" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {templates.length <= 1 ? (
          <p className="text-[11px] text-text2 mt-2">Должен остаться хотя бы один шаблон — последний удалить нельзя.</p>
        ) : null}
      </div>

      <Modal
        open={modal !== null}
        title={modal?.kind === "create" ? `Новый шаблон ${documentTypeLabel(modal.docType)}` : "Переименовать шаблон"}
        onClose={() => setModal(null)}
        widthClass="max-w-md"
      >
        <div className="grid gap-3">
          <div>
            <div className="text-xs text-text2 mb-1">Название (видно в админке и при выборе в сделке)</div>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="КП — для партнёров"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitModal();
              }}
            />
          </div>
          {error ? <div className="text-sm text-danger">{error}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Отмена
            </Button>
            <Button onClick={() => void submitModal()} disabled={busy}>
              {modal?.kind === "create" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
