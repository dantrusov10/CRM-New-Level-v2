/** Self-hosted шрифты (Fontsource) — коллекция для КП/ТКП */
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
import "@fontsource/pt-sans/400.css";
import "@fontsource/pt-sans/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";

import type { KpFontFamilyId } from "./types";

export type { KpFontFamilyId };

export const KP_FONT_FAMILIES: { id: KpFontFamilyId; label: string; stack: string; group?: string }[] = [
  { id: "inter", label: "Inter", stack: '"Inter", system-ui, sans-serif', group: "Sans" },
  { id: "roboto", label: "Roboto", stack: '"Roboto", system-ui, sans-serif', group: "Sans" },
  { id: "open-sans", label: "Open Sans", stack: '"Open Sans", system-ui, sans-serif', group: "Sans" },
  { id: "source-sans-3", label: "Source Sans 3", stack: '"Source Sans 3", system-ui, sans-serif', group: "Sans" },
  { id: "lato", label: "Lato", stack: '"Lato", system-ui, sans-serif', group: "Sans" },
  { id: "montserrat", label: "Montserrat", stack: '"Montserrat", system-ui, sans-serif', group: "Sans" },
  { id: "nunito-sans", label: "Nunito Sans", stack: '"Nunito Sans", system-ui, sans-serif', group: "Sans" },
  { id: "pt-sans", label: "PT Sans", stack: '"PT Sans", system-ui, sans-serif', group: "Sans" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif', group: "Sans" },
  { id: "rubik", label: "Rubik", stack: '"Rubik", system-ui, sans-serif', group: "Sans" },
  { id: "manrope", label: "Manrope", stack: '"Manrope", system-ui, sans-serif', group: "Sans" },
  { id: "fira-sans", label: "Fira Sans", stack: '"Fira Sans", system-ui, sans-serif', group: "Sans" },
  { id: "noto-sans", label: "Noto Sans", stack: '"Noto Sans", system-ui, sans-serif', group: "Sans" },
  { id: "oswald", label: "Oswald", stack: '"Oswald", system-ui, sans-serif', group: "Display" },
  { id: "playfair-display", label: "Playfair", stack: '"Playfair Display", Georgia, serif', group: "Serif" },
  { id: "merriweather", label: "Merriweather", stack: '"Merriweather", Georgia, serif', group: "Serif" },
  { id: "jetbrains-mono", label: "JetBrains Mono", stack: '"JetBrains Mono", monospace', group: "Mono" },
  { id: "system", label: "Системный", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif', group: "Система" },
];

export function fontStackById(id?: string): string {
  return KP_FONT_FAMILIES.find((f) => f.id === id)?.stack || KP_FONT_FAMILIES[0].stack;
}
