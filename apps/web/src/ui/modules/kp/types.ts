export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
/** PocketBase/TS unions may include explicit `undefined` on optional keys; allow it for template JSON trees. */
export type JsonObject = { [key: string]: JsonValue | undefined };

export type KpTemplate = {
  id?: string;
  name: string;
  isActive?: boolean;
  isDefault?: boolean;
  template_json: JsonObject;
};

export type KpInstance = {
  id?: string;
  deal_id: string;
  template_id: string;
  status: KpInstanceStatus;
  version: number;
  input_json: JsonObject;
  computed_json: JsonObject;
};

export type SpecItem = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountPercent?: number;
  vatPercent?: number;
  source?: "price" | "custom";
  price_list_item_id?: string | null;
};


export type KpFieldOption = { value: string; label: string };
export type KpField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  default?: JsonValue;
  min?: number;
  max?: number;
  options?: KpFieldOption[];
  mapping?: JsonObject;
  visibility?: JsonObject;
  dataSource?: JsonObject;
  ui?: JsonObject;
};
export type KpSection = { id: string; title: string; fields: KpField[] };
export type KpBranding = JsonObject & {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  disclaimer?: string;
  technicalIntroDefault?: string;
  signature?: { name?: string; title?: string; phone?: string; email?: string };
};
export type KpDocumentType = "kp" | "tkp";
export type KpInstanceStatus = "draft" | "sent" | "final";

/** Сохранённый фрагмент для библиотеки блоков */
export type KpBlockLibraryItem = {
  id: string;
  name: string;
  block: KpPdfBlock;
  createdAt?: string;
};
export type KpDocumentLayoutMode = "flow" | "canvas";

/** Позиция блока на листе A4 (режим «холст / Figma»), px от верхнего левого угла листа */
export type KpBlockRect = {
  pageIndex?: number;
  x: number;
  y: number;
  w: number;
  h?: number;
  zIndex?: number;
  /** Поворот блока, градусы */
  rotateDeg?: number;
};

/** Локальные стили блока (перекрывают общий дизайн документа) */
export type KpBlockStyle = {
  fontFamily?: KpPdfDesign["fontFamily"];
  fontSizePt?: number;
  textColor?: string;
  bgColor?: string;
  paddingPx?: number;
  borderRadiusPx?: number;
  textAlign?: "left" | "center" | "right";
  borderColor?: string;
  borderWidthPx?: number;
  opacity?: number;
};

export type KpPdfBlockType =
  | "header"
  | "client_cards"
  | "technical"
  | "custom"
  | "image"
  | "specification_table"
  | "totals"
  | "conditions"
  | "signature";

export type KpFontFamilyId =
  | "inter"
  | "roboto"
  | "open-sans"
  | "merriweather"
  | "lato"
  | "montserrat"
  | "nunito-sans"
  | "source-sans-3"
  | "pt-sans"
  | "ibm-plex-sans"
  | "rubik"
  | "manrope"
  | "oswald"
  | "playfair-display"
  | "fira-sans"
  | "noto-sans"
  | "jetbrains-mono"
  | "system"
  | "arial"
  | "helvetica"
  | "verdana"
  | "tahoma"
  | "trebuchet"
  | "segoe-ui"
  | "calibri"
  | "times"
  | "georgia"
  | "palatino"
  | "garamond"
  | "courier"
  | "consolas";

export type KpPdfDesign = {
  /** flow — список разделов; canvas — свободное размещение на листе */
  layoutMode?: KpDocumentLayoutMode;
  layoutStyle?: "classic" | "modern" | "compact";
  fontScale?: "sm" | "md" | "lg";
  fontFamily?: KpFontFamilyId;
  bodyFontSizePt?: number;
  headingFontSizePt?: number;
  lineHeight?: number;
  letterSpacingPx?: number;
  pageMarginMm?: number;
  secondaryColor?: string;
  /** Сетка на холсте (px) */
  canvasGridPx?: number;
  canvasSnap?: boolean;
  canvasShowGrid?: boolean;
  /** Фон листа A4 (URL или data URL) */
  pageBackgroundUrl?: string;
  pageBackgroundOpacity?: number;
  tableStyle?: "bordered" | "plain" | "striped";
  paperTone?: "white" | "warm";
  paperBg?: string;
  textColor?: string;
  tableHeaderBg?: string;
  tableHeaderText?: string;
  tableHeaderUseAccent?: boolean;
  accentColor?: string;
  showValidityLine?: boolean;
  validityDays?: number;
};

export type KpPdfBlock = {
  id: string;
  type: KpPdfBlockType;
  enabled: boolean;
  title?: string;
  /** Текст произвольного раздела (HTML: p, strong, ul, li, br) */
  bodyHtml?: string;
  /** Начать с нового листа A4 (режим flow) */
  pageBreakBefore?: boolean;
  /** Позиция на холсте (режим canvas) */
  rect?: KpBlockRect;
  /** Стили конкретного блока */
  style?: KpBlockStyle;
  /** URL или data URL картинки (блок image) */
  imageUrl?: string;
  /** Группа для совместного перемещения */
  groupId?: string;
};

export type KpTemplateConfig = JsonObject & {
  version?: number;
  name?: string;
  documentType?: KpDocumentType;
  isActive?: boolean;
  isDefault?: boolean;
  branding?: KpBranding;
  defaults?: { currency?: string; vatPercent?: number; partnerModeEnabled?: boolean };
  ui?: { layout?: string; sections?: KpSection[]; managerFields?: KpField[] };
  pdfBlocks?: KpPdfBlock[];
  specification?: {
    title?: string;
    showVatColumn?: boolean;
    columns?: Array<{ key: string; label?: string; width?: string | number; align?: string; optional?: boolean }>;
    totals?: Array<{ key: string; label?: string }>;
  };
  calcRules?: { applyPartnerDiscountFirst?: boolean; discounts?: JsonObject };
  pdfDesign?: KpPdfDesign;
  pdf?: JsonObject;
  /** Теги для фильтра в сделке: отдел, продукт */
  tags?: string[];
  /** Библиотека переиспользуемых разделов */
  blockLibrary?: KpBlockLibraryItem[];
};
export type KpInput = Record<string, JsonValue>;
export type PriceListItem = {
  id: string;
  product_name?: string;
  name?: string;
  sku?: string;
  price?: number;
  vat_percent?: number;
  meta?: { vat_mode?: 'with_vat' | 'without_vat' } & JsonObject;
};
export type KpTemplateRecord = {
  id: string;
  name?: string;
  logo?: string;
  is_active?: boolean;
  is_default?: boolean;
  template_json?: KpTemplateConfig;
};
export type KpInstanceRecord = {
  id: string;
  deal_id: string;
  template_id: string;
  status: 'draft' | 'final';
  version?: number;
  input_json?: KpInput;
  computed_json?: { items?: SpecItem[]; totals?: JsonObject } & JsonObject;
};
