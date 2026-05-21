import type { CSSProperties } from "react";
import { fontStackById } from "./kpDocumentFonts";
import type { KpPdfBlock, KpTemplateConfig } from "./types";
import { normalizePdfDesign } from "./kpDesign";

export function blockInlineStyleCss(block: KpPdfBlock, template: KpTemplateConfig): CSSProperties {
  const doc = normalizePdfDesign(template);
  const s = block.style || {};
  const fontId = s.fontFamily || doc.fontFamily;
  return {
    fontFamily: fontStackById(fontId),
    fontSize: s.fontSizePt ? `${s.fontSizePt}pt` : undefined,
    color: s.textColor || undefined,
    background: s.bgColor || undefined,
    padding: s.paddingPx != null ? `${s.paddingPx}px` : undefined,
    borderRadius: s.borderRadiusPx != null ? `${s.borderRadiusPx}px` : undefined,
    textAlign: s.textAlign || undefined,
    border:
      s.borderWidthPx && s.borderColor
        ? `${s.borderWidthPx}px solid ${s.borderColor}`
        : undefined,
    opacity: s.opacity != null ? s.opacity : undefined,
    overflow: "hidden",
    height: "100%",
    boxSizing: "border-box",
  };
}
