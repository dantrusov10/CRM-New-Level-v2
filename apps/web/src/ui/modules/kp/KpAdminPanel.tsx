import React from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { pb } from "../../../lib/pb";
import { KpAdminWizard } from "./KpAdminWizard";
import { KpTemplateSwitcher } from "./KpTemplateSwitcher";
import { getDocumentType } from "./kpDocumentMeta";
import {
  buildNewTemplateConfig,
  countKpInstancesForTemplate,
  ensureKpAndTkpTemplates,
} from "./kpTemplates";
import type { KpDocumentType, KpTemplateConfig, KpTemplateRecord } from "./types";

/** Админка КП: конструктор шаблона + прайс (`/admin/kp`). */
export function KpAdminPanel() {
  const [templates, setTemplates] = React.useState<KpTemplateRecord[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState("");
  /** Увеличивается при «Редактировать» — мастер открывает шаг шаблона и прокручивает к редактору. */
  const [editFocusTick, setEditFocusTick] = React.useState(0);
  const [confirmDelete, setConfirmDelete] = React.useState<{
    id: string;
    name: string;
    mode: "deactivate" | "delete";
    used?: number;
  } | null>(null);

  async function load() {
    const list = await ensureKpAndTkpTemplates();
    setTemplates(list);
    setActiveId((prev) => {
      if (prev && list.some((t) => t.id === prev)) return prev;
      return list[0]?.id || null;
    });
  }

  React.useEffect(() => {
    void load();
  }, []);

  const active = templates.find((t) => t.id === activeId) || null;

  function openTemplateEditor(id: string) {
    setActiveId(id);
    setEditFocusTick((n) => n + 1);
  }

  async function save(patch: { template_json: KpTemplateConfig; name: string }) {
    if (!active?.id) return;
    setBusy(true);
    setActionError("");
    try {
      await pb.collection("settings_kp_templates").update(active.id, {
        name: patch.name,
        template_json: patch.template_json,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate(type: KpDocumentType, displayName: string) {
    setBusy(true);
    setActionError("");
    try {
      const template_json = buildNewTemplateConfig(type, displayName);
      const isFirstOfType = !templates.some((t) => {
        const json = t.template_json;
        return json && typeof json === "object" && getDocumentType(json as KpTemplateConfig) === type;
      });
      const created = await pb.collection("settings_kp_templates").create({
        name: displayName,
        is_active: true,
        is_default: type === "kp" && isFirstOfType,
        template_json,
      });
      await load();
      if (created?.id) openTemplateEditor(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function renameTemplate(id: string, displayName: string) {
    setBusy(true);
    setActionError("");
    try {
      const rec = templates.find((t) => t.id === id);
      const json = rec?.template_json && typeof rec.template_json === "object" ? { ...rec.template_json } : {};
      (json as KpTemplateConfig).name = displayName;
      await pb.collection("settings_kp_templates").update(id, {
        name: displayName,
        template_json: json,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (templates.length <= 1) {
      setActionError("Нельзя удалить последний шаблон.");
      return;
    }
    const rec = templates.find((t) => t.id === id);
    if (!rec) return;

    const used = await countKpInstancesForTemplate(id);
    if (used > 0) {
      setConfirmDelete({ id, name: rec.name || "Шаблон", mode: "deactivate", used });
      return;
    }
    setConfirmDelete({ id, name: rec.name || "Шаблон", mode: "delete" });
  }

  async function runConfirmedDelete() {
    if (!confirmDelete) return;
    const { id, mode } = confirmDelete;
    setBusy(true);
    setActionError("");
    try {
      if (mode === "deactivate") {
        await pb.collection("settings_kp_templates").update(id, { is_active: false });
      } else {
        await pb.collection("settings_kp_templates").delete(id);
      }
      await load();
      if (activeId === id) {
        const next = templates.find((t) => t.id !== id) || templates.filter((t) => t.id !== id)[0];
        setActiveId(next?.id || null);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Не удалось выполнить действие");
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  if (!templates.length) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">КП / ТКП</div>
          <div className="text-xs text-text2 mt-1">Загрузка шаблонов…</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text2">Проверьте коллекцию settings_kp_templates в PocketBase.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <KpTemplateSwitcher
        templates={templates}
        activeId={activeId}
        onEdit={openTemplateEditor}
        onCreate={createTemplate}
        onRename={renameTemplate}
        onDelete={deleteTemplate}
        busy={busy}
      />
      {actionError ? <div className="text-sm text-danger px-1">{actionError}</div> : null}
      {active ? (
        <KpAdminWizard
          key={active.id}
          templateRecord={active}
          onSave={save}
          onReload={load}
          editFocusTick={editFocusTick}
        />
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-text2">Выберите шаблон для редактирования.</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.mode === "deactivate" ? "Деактивировать шаблон?" : "Удалить шаблон?"}
        message={
          confirmDelete?.mode === "deactivate" ? (
            <>
              Шаблон «{confirmDelete.name}» использован в {confirmDelete.used} черновиках. Удаление недоступно —
              деактивировать? Шаблон скроется из списка, черновики сохранятся.
            </>
          ) : (
              <>Удалить шаблон «{confirmDelete?.name}» безвозвратно?</>
            )
        }
        confirmLabel={confirmDelete?.mode === "deactivate" ? "Деактивировать" : "Удалить"}
        variant={confirmDelete?.mode === "delete" ? "danger" : "default"}
        onConfirm={() => void runConfirmedDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
