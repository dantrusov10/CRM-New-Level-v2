/** Подключаем веб-шрифты для листа A4 (self-hosted через Fontsource / Google Fonts collection). */
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";

export type KpFontFamilyId =
  | "inter"
  | "roboto"
  | "open-sans"
  | "merriweather"
  | "lato"
  | "montserrat"
  | "nunito-sans"
  | "source-sans-3"
  | "system";

export const KP_FONT_FAMILIES: { id: KpFontFamilyId; label: string; stack: string }[] = [
  { id: "inter", label: "Inter", stack: '"Inter", system-ui, sans-serif' },
  { id: "roboto", label: "Roboto", stack: '"Roboto", system-ui, sans-serif' },
  { id: "open-sans", label: "Open Sans", stack: '"Open Sans", system-ui, sans-serif' },
  { id: "source-sans-3", label: "Source Sans 3", stack: '"Source Sans 3", system-ui, sans-serif' },
  { id: "lato", label: "Lato", stack: '"Lato", system-ui, sans-serif' },
  { id: "montserrat", label: "Montserrat", stack: '"Montserrat", system-ui, sans-serif' },
  { id: "nunito-sans", label: "Nunito Sans", stack: '"Nunito Sans", system-ui, sans-serif' },
  { id: "merriweather", label: "Merriweather", stack: '"Merriweather", Georgia, serif' },
  { id: "system", label: "Системный", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
];

export function fontStackById(id?: string): string {
  return KP_FONT_FAMILIES.find((f) => f.id === id)?.stack || KP_FONT_FAMILIES[0].stack;
}
