import React from "react";
import { Save } from "lucide-react";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { KpDesignSettings } from "./KpDesignSettings";
import { KpTemplateImportExport } from "./KpTemplateImportExport";
import { KpTemplatePresetGallery } from "./KpTemplatePresetGallery";
import type { KpTemplateConfig } from "./types";

/** Настройки шаблона в модалке — чтобы холст занимал всю ширину в один ряд. */
export function KpCanvasSettingsModal({
  open,
  onClose,
  draft,
  onChange,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  draft: KpTemplateConfig;
  onChange: (next: KpTemplateConfig) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Modal open={open} title="Оформление и импорт" onClose={onClose} widthClass="max-w-3xl">
      <div className="grid gap-4 max-h-[70vh] overflow-y-auto crm-scrollbar pr-1">
        <div>
          <div className="text-xs text-text2 mb-1">Название шаблона</div>
          <Input value={draft?.name || ""} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </div>
        <KpTemplatePresetGallery draft={draft} onApply={onChange} />
        <KpTemplateImportExport draft={draft} onImport={onChange} />
        <KpDesignSettings draft={draft} onChange={onChange} />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
        <Button onClick={onSave} disabled={saving}>
          <Save size={14} className="mr-1" />
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </Modal>
  );
}
