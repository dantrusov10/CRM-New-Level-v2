import type { CSSProperties } from "react";
import { normalizePdfDesign } from "./kpDesign";
import type { KpTemplateConfig } from "./types";

export function pageBackgroundLayerStyle(template: KpTemplateConfig): CSSProperties {
  const d = normalizePdfDesign(template);
  if (!d.pageBackgroundUrl) return { display: "none" };
  return {
    position: "absolute",
    inset: 0,
    backgroundImage: `url(${d.pageBackgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: d.pageBackgroundOpacity ?? 1,
    pointerEvents: "none",
    zIndex: 0,
  };
}
