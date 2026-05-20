import { pb } from "../../../lib/pb";
import { DEFAULT_KP_TEMPLATE_V1, DEFAULT_TKP_TEMPLATE_V1 } from "./defaultTemplate";
import { getDocumentType } from "./kpDocumentMeta";
import type { KpDocumentType, KpTemplateConfig, KpTemplateRecord } from "./types";

export async function listActiveKpTemplates(): Promise<KpTemplateRecord[]> {
  const res = await pb
    .collection("settings_kp_templates")
    .getList(1, 50, { filter: "is_active=true", sort: "name" })
    .catch(() => ({ items: [] as KpTemplateRecord[] }));
  return res.items || [];
}

export async function countKpInstancesForTemplate(templateId: string): Promise<number> {
  const res = await pb
    .collection("kp_instances")
    .getList(1, 1, { filter: `template_id="${templateId}"`, fields: "id" })
    .catch(() => ({ totalItems: 0 }));
  return Number(res.totalItems || 0);
}

function hasType(templates: KpTemplateRecord[], type: KpDocumentType) {
  return templates.some((t) => {
    const json = t.template_json;
    return json && typeof json === "object" && getDocumentType(json as KpTemplateConfig) === type;
  });
}

export async function ensureKpAndTkpTemplates(): Promise<KpTemplateRecord[]> {
  let templates = await listActiveKpTemplates();

  if (!hasType(templates, "kp")) {
    const created = await pb
      .collection("settings_kp_templates")
      .create({
        name: DEFAULT_KP_TEMPLATE_V1.name,
        is_active: true,
        is_default: true,
        template_json: DEFAULT_KP_TEMPLATE_V1,
      })
      .catch(() => null);
    if (created) templates = [...templates, created as KpTemplateRecord];
  }

  if (!hasType(templates, "tkp")) {
    const created = await pb
      .collection("settings_kp_templates")
      .create({
        name: DEFAULT_TKP_TEMPLATE_V1.name,
        is_active: true,
        is_default: false,
        template_json: DEFAULT_TKP_TEMPLATE_V1,
      })
      .catch(() => null);
    if (created) templates = [...templates, created as KpTemplateRecord];
  }

  return templates;
}

export function pickDefaultTemplate(templates: KpTemplateRecord[], prefer: KpDocumentType = "kp"): KpTemplateRecord | null {
  if (!templates.length) return null;
  const byType = templates.find((t) => {
    const json = t.template_json;
    return json && typeof json === "object" && getDocumentType(json as KpTemplateConfig) === prefer;
  });
  if (byType) return byType;
  const def = templates.find((t) => t.is_default);
  return def || templates[0];
}

export function buildNewTemplateConfig(type: KpDocumentType, displayName: string): KpTemplateConfig {
  const base = type === "tkp" ? DEFAULT_TKP_TEMPLATE_V1 : DEFAULT_KP_TEMPLATE_V1;
  const json = JSON.parse(JSON.stringify(base)) as KpTemplateConfig;
  json.name = displayName;
  json.documentType = type;
  return json;
}
