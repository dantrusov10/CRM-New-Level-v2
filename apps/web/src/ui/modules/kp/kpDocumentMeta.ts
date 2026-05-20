import type { KpDocumentType, KpTemplateConfig, KpTemplateRecord } from "./types";

export function getDocumentType(template: KpTemplateConfig | undefined): KpDocumentType {
  return template?.documentType === "tkp" ? "tkp" : "kp";
}

export function documentTypeLabel(type: KpDocumentType): string {
  return type === "tkp" ? "ТКП" : "КП";
}

export function documentTitle(type: KpDocumentType): string {
  return type === "tkp" ? "Технико-коммерческое предложение" : "Коммерческое предложение";
}

export function documentFilePrefix(type: KpDocumentType): string {
  return type === "tkp" ? "ТКП" : "КП";
}

export function getTemplateDocumentType(rec: KpTemplateRecord): KpDocumentType {
  const json = rec?.template_json;
  return json && typeof json === "object" ? getDocumentType(json as KpTemplateConfig) : "kp";
}

export function templateDisplayName(rec: KpTemplateRecord): string {
  const tag = documentTypeLabel(getTemplateDocumentType(rec));
  return `${tag} · ${rec.name || "Шаблон"}`;
}
