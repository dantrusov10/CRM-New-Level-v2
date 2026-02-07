export type KpTemplate = {
  id?: string;
  name: string;
  isActive?: boolean;
  isDefault?: boolean;
  template_json: any;
};

export type KpInstance = {
  id?: string;
  deal_id: string;
  template_id: string;
  status: "draft" | "final";
  version: number;
  input_json: any;
  computed_json: any;
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
