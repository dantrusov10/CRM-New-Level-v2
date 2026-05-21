/** Подключаем веб-шрифты для листа A4 (self-hosted через Fontsource). */
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";

export type KpFontFamilyId = "inter" | "roboto" | "open-sans" | "merriweather" | "system";

export const KP_FONT_FAMILIES: { id: KpFontFamilyId; label: string; stack: string }[] = [
  { id: "inter", label: "Inter (современный)", stack: '"Inter", system-ui, sans-serif' },
  { id: "roboto", label: "Roboto", stack: '"Roboto", system-ui, sans-serif' },
  { id: "open-sans", label: "Open Sans", stack: '"Open Sans", system-ui, sans-serif' },
  { id: "merriweather", label: "Merriweather (с засечками)", stack: '"Merriweather", Georgia, serif' },
  { id: "system", label: "Системный", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
];

export function fontStackById(id?: string): string {
  return KP_FONT_FAMILIES.find((f) => f.id === id)?.stack || KP_FONT_FAMILIES[0].stack;
}
