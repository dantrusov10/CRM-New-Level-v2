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
  status: "draft" | "final";
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
  signature?: { name?: string; title?: string; phone?: string; email?: string };
};
export type KpTemplateConfig = JsonObject & {
  version?: number;
  name?: string;
  isActive?: boolean;
  isDefault?: boolean;
  branding?: KpBranding;
  defaults?: { currency?: string; vatPercent?: number; partnerModeEnabled?: boolean };
  ui?: { layout?: string; sections?: KpSection[]; managerFields?: KpField[] };
  specification?: { title?: string; showVatColumn?: boolean; columns?: Array<{ key: string; label?: string; width?: string | number; align?: string; optional?: boolean }> };
  calcRules?: { applyPartnerDiscountFirst?: boolean; discounts?: JsonObject };
  pdfDesign?: { paperBg?: string; textColor?: string; tableHeaderBg?: string; tableHeaderText?: string };
  pdf?: JsonObject;
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
