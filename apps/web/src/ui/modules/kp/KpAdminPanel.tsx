import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { pb } from "../../../lib/pb";
import { DEFAULT_KP_TEMPLATE_V1, DEFAULT_TKP_TEMPLATE_V1 } from "./defaultTemplate";
import { KpAdminWizard } from "./KpAdminWizard";
import { KpTemplateSwitcher } from "./KpTemplateSwitcher";
import { ensureKpAndTkpTemplates } from "./kpTemplates";
import type { KpDocumentType, KpTemplateConfig, KpTemplateRecord } from "./types";

/** Админка КП: конструктор шаблона + прайс (`/admin/kp`). */
export function KpAdminPanel() {
  const [templates, setTemplates] = React.useState<KpTemplateRecord[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

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

  async function save(patch: { template_json: KpTemplateConfig; name: string }) {
    if (!active?.id) return;
    await pb.collection("settings_kp_templates").update(active.id, patch);
    await load();
  }

  async function createTemplate(type: KpDocumentType) {
    const base = type === "tkp" ? DEFAULT_TKP_TEMPLATE_V1 : DEFAULT_KP_TEMPLATE_V1;
    const created = await pb.collection("settings_kp_templates").create({
      name: base.name,
      is_active: true,
      is_default: type === "kp",
      template_json: base,
    });
    await load();
    if (created?.id) setActiveId(created.id);
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
        onSelect={setActiveId}
        onCreate={(type) => void createTemplate(type)}
      />
      {active ? <KpAdminWizard templateRecord={active} onSave={save} onReload={load} /> : null}
    </div>
  );
}
