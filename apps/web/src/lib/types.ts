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
  stage_name: string;
  position: number;
  color: string;
  is_final?: boolean;
  final_type?: "win" | "loss" | null;
};

export type Deal = {
  id: Id;
  title: string;
  company_id?: Id;
  responsible_id?: Id;
  stage_id?: Id;
  budget?: number;
  turnover?: number;
  margin_percent?: number;
  discount_percent?: number;
  sales_channel?: string; // "прямой" | "партнёр"
  partner?: string;
  distributor?: string;
  procurement_format?: string;
  created?: string;
  updated?: string;
};

export type TimelineItem = {
  id: Id;
  deal_id: Id;
  user_id: Id;
  action: string;
  comment?: string;
  payload?: any;
  timestamp?: string;
  created?: string;
};

export type AiInsight = {
  id: Id;
  deal_id: Id;
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
