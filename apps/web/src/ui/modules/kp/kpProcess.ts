import { pb } from "../../../lib/pb";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import type { KpTemplateConfig } from "./types";

export type KpProcessStep = {
  id: string;
  title: string;
  hint: string;
};

export const ADMIN_KP_STEPS: KpProcessStep[] = [
  {
    id: "intro",
    title: "С чего начать",
    hint: "Один раз настраиваете прайс и шаблон — дальше менеджеры собирают КП в сделке за 3–5 минут.",
  },
  {
    id: "price",
    title: "Прайс-лист",
    hint: "Загрузите Excel/CSV с позициями: название, цена, артикул. Без прайса менеджер не сможет добавить строки.",
  },
  {
    id: "template",
    title: "Шаблон PDF",
    hint: "Логотип, название компании, блоки PDF и поля, которые менеджер заполнит в сделке.",
  },
  {
    id: "check",
    title: "Проверка",
    hint: "Посмотрите демо-PDF. Если всё ок — система готова, можно идти в сделку.",
  },
];

export const DEAL_KP_STEPS: KpProcessStep[] = [
  {
    id: "client",
    title: "Клиент",
    hint: "Данные подтянутся из компании сделки. Проверьте название, ИНН и email.",
  },
  {
    id: "items",
    title: "Позиции",
    hint: "Добавьте строки из прайса или вручную. Минимум одна позиция для PDF.",
  },
  {
    id: "conditions",
    title: "Условия",
    hint: "Скидки, оплата, комментарий — попадут в PDF, если включены в шаблоне.",
  },
  {
    id: "pdf",
    title: "PDF",
    hint: "Предпросмотр → сохранить черновик → скачать PDF. Версия сохранится по сделке.",
  },
];

export type KpReadiness = {
  priceCount: number;
  hasTemplate: boolean;
  pdfBlocksEnabled: number;
  ready: boolean;
  missing: string[];
};

export async function fetchKpReadiness(): Promise<KpReadiness> {
  const priceRes = await pb.collection("price_list_items").getList(1, 1, { fields: "id" }).catch(() => ({ totalItems: 0 }));
  const priceCount = Number(priceRes.totalItems || 0);

  const tplRes = await pb
    .collection("settings_kp_templates")
    .getList(1, 1, { filter: "is_default=true && is_active=true" })
    .catch(() => ({ items: [] as Array<{ template_json?: KpTemplateConfig }> }));

  const tpl = tplRes.items?.[0];
  const hasTemplate = Boolean(tpl);
  const json = (tpl?.template_json || {}) as KpTemplateConfig;
  const blocks = ensurePdfBlocks(json).filter((b) => b.enabled);
  const pdfBlocksEnabled = blocks.length;
  const hasTable = blocks.some((b) => b.type === "specification_table");

  const missing: string[] = [];
  if (priceCount < 1) missing.push("Загрузите прайс-лист (шаг 2 в админке КП).");
  if (!hasTemplate) missing.push("Создайте шаблон КП (шаг 3).");
  if (!hasTable) missing.push("В шаблоне включите блок «Таблица спецификации».");
  if (pdfBlocksEnabled < 2) missing.push("Включите хотя бы 2 блока в PDF (шапка + таблица).");

  return {
    priceCount,
    hasTemplate,
    pdfBlocksEnabled,
    ready: missing.length === 0,
    missing,
  };
}

/** Секции формы менеджера по шагам мастера в сделке */
export function dealWizardSectionKind(sectionId: string): "client" | "conditions" | "other" {
  if (sectionId === "client" || sectionId === "dealParams") return "client";
  if (sectionId === "discounts" || sectionId === "payment" || sectionId === "notes" || sectionId === "technical")
    return "conditions";
  return "other";
}
