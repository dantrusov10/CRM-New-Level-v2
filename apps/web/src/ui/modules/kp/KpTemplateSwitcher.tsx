import React from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { documentTypeLabel, getTemplateDocumentType, templateDisplayName } from "./kpDocumentMeta";
import type { KpDocumentType, KpTemplateRecord } from "./types";

export function KpTemplateSwitcher({
  templates,
  activeId,
  onSelect,
  onCreate,
}: {
  templates: KpTemplateRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate?: (type: KpDocumentType) => void;
}) {
  const hasKp = templates.some((t) => getTemplateDocumentType(t) === "kp");
  const hasTkp = templates.some((t) => getTemplateDocumentType(t) === "tkp");

  return (
    <div className="rounded-card border border-border bg-rowHover p-3">
      <div className="text-xs font-bold uppercase text-primary mb-2">Шаблоны документов</div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const type = getTemplateDocumentType(t);
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                active ? "border-primary bg-primary/15" : "border-border bg-white hover:border-primary/50"
              }`}
            >
              <FileText size={16} className="shrink-0" />
              <span>
                <Badge className="mb-0.5">{documentTypeLabel(type)}</Badge>
                <span className="block text-xs font-semibold">{t.name || templateDisplayName(t)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {onCreate ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!hasKp ? (
            <Button small variant="secondary" onClick={() => onCreate("kp")}>
              <Plus size={14} className="mr-1" />
              Добавить КП
            </Button>
          ) : null}
          {!hasTkp ? (
            <Button small variant="secondary" onClick={() => onCreate("tkp")}>
              <Plus size={14} className="mr-1" />
              Добавить ТКП
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
