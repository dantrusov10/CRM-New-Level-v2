// Minimal typing for key collections (PocketBase)
export type Id = string;

export type Company = {
  id: Id;
  name: string;
  city?: string;
  site?: string;
  inn?: string;
  owner?: Id; // users
  created?: string;
  updated?: string;
};

export type FunnelStage = {
  id: Id;
  name: string;
  order: number;
  color: string;
  is_final?: boolean;
  final_type?: "win" | "loss" | null;
};

export type Deal = {
  id: Id;
  name: string;
  company?: Id;
  owner?: Id;
  stage?: Id;
  budget?: number;
  turnover?: number;
  margin_percent?: number;
  discount_percent?: number;
  channel?: string; // direct/partner or settings_channels
  partner?: string;
  distributor?: string;
  procurement_format?: string;
  created?: string;
  updated?: string;
};

export type TimelineItem = {
  id: Id;
  entity_type: "deal" | "company";
  entity_id: Id;
  action: string;
  message?: string;
  by?: Id;
  created?: string;
};

export type AiInsight = {
  id: Id;
  deal: Id;
  score_percent?: number;
  summary?: string;
  recommendations?: string;
  risks?: string;
  created?: string;
};

export type Role = {
  id: Id;
  name: string;
  permissions_json: any; // {section:{read,create,update,delete}}
};
