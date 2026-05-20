import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { pb } from "../../../lib/pb";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";
import { KpTemplateEditor } from "./KpTemplateEditor";
import { PriceListAdmin } from "./PriceListAdmin";
import type { KpTemplateConfig, KpTemplateRecord } from "./types";

/** Админка КП: шаблон + прайс (используется в /admin/kp и вкладке парсеров). */
export function KpAdminPanel() {
  const [tpl, setTpl] = React.useState<KpTemplateRecord | null>(null);

  async function ensureDefault() {
    const list = await pb
      .collection("settings_kp_templates")
      .getList(1, 1, { filter: "is_default=true && is_active=true" })
      .catch(() => ({ items: [] as KpTemplateRecord[] }));
    if (list.items[0]) return list.items[0];
    return pb
      .collection("settings_kp_templates")
      .create({
        name: DEFAULT_KP_TEMPLATE_V1.name,
        is_active: true,
        is_default: true,
        template_json: DEFAULT_KP_TEMPLATE_V1,
      })
      .catch(() => null);
  }

  async function load() {
    const t = await ensureDefault();
    setTpl(t);
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function save(patch: { template_json: KpTemplateConfig; name: string }) {
    if (!tpl?.id) return;
    await pb.collection("settings_kp_templates").update(tpl.id, patch);
  }

  if (!tpl) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">КП</div>
          <div className="text-xs text-text2 mt-1">Загрузка шаблона…</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text2">
            Проверьте коллекцию <code>settings_kp_templates</code> в PocketBase.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <KpTemplateEditor templateRecord={tpl} onSave={save} onReload={load} />
      <PriceListAdmin />
    </div>
  );
}
