import type { KpFontFamilyId } from "./types";
import { KP_FONT_FAMILIES } from "./kpDocumentFonts";

export type KpFontOption = {
  id: KpFontFamilyId | string;
  label: string;
  stack: string;
  group: string;
};

/** Системные / базовые гарнитуры (без загрузки файлов). */
export const SYSTEM_BASIC_FONTS: KpFontOption[] = [
  { id: "system", label: "Системный UI", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif', group: "Системные" },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif", group: "Системные" },
  { id: "helvetica", label: "Helvetica", stack: "Helvetica, Arial, sans-serif", group: "Системные" },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif", group: "Системные" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif", group: "Системные" },
  { id: "trebuchet", label: "Trebuchet MS", stack: '"Trebuchet MS", Helvetica, sans-serif', group: "Системные" },
  { id: "segoe-ui", label: "Segoe UI", stack: '"Segoe UI", Tahoma, sans-serif', group: "Системные" },
  { id: "calibri", label: "Calibri", stack: "Calibri, Candara, sans-serif", group: "Системные" },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif', group: "Системные" },
  { id: "georgia", label: "Georgia", stack: "Georgia, Times, serif", group: "Системные" },
  { id: "palatino", label: "Palatino", stack: '"Palatino Linotype", Palatino, serif', group: "Системные" },
  { id: "garamond", label: "Garamond", stack: "Garamond, serif", group: "Системные" },
  { id: "courier", label: "Courier New", stack: '"Courier New", Courier, monospace', group: "Системные" },
  { id: "consolas", label: "Consolas", stack: "Consolas, monospace", group: "Системные" },
];

const WEB_FONTS: KpFontOption[] = KP_FONT_FAMILIES.filter((f) => f.id !== "system").map((f) => ({
  id: f.id,
  label: f.label,
  stack: f.stack,
  group: f.group || "Веб-шрифты (Fontsource)",
}));

/** Полный каталог для выпадающего списка. */
export const KP_ALL_FONT_OPTIONS: KpFontOption[] = [...WEB_FONTS, ...SYSTEM_BASIC_FONTS.filter((f) => f.id !== "system")];

export function fontStackByCatalogId(id?: string): string {
  const all = [...KP_FONT_FAMILIES.map((f) => ({ id: f.id, stack: f.stack })), ...SYSTEM_BASIC_FONTS.map((f) => ({ id: f.id, stack: f.stack }))];
  return all.find((f) => f.id === id)?.stack || KP_FONT_FAMILIES[0].stack;
}
