export type Id = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type Company = {
  id: Id;
  name: string;
  inn?: string;
  city?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  legal_entity?: string;
  responsible_id?: Id;
  created?: string;
  updated?: string;
};

export type FunnelStage = {
  id: Id;
  stage_name: string;
  position: number;
  color?: string;
  active?: boolean;
  is_final?: boolean;
  final_type?: "none" | "won" | "lost";
  default_prob?: number;
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
  sales_channel?: string;
  partner?: string;
  distributor?: string;
  purchase_format?: string;
  activity_type?: string;
  endpoints?: number;
  infrastructure_size?: string;
  presale?: string;
  attraction_channel?: string;
  attraction_date?: string;
  registration_deadline?: string;
  test_start?: string;
  test_end?: string;
  delivery_date?: string;
  expected_payment_date?: string;
  payment_received_date?: string;
  project_map_link?: string;
  kaiten_link?: string;
  current_score?: number;
  current_recommendations?: JsonValue;
  created?: string;
  updated?: string;
};

export type TimelineItem = {
  id: Id;
  deal_id: Id;
  user_id?: Id;
  action: string;
  comment?: string;
  payload?: JsonValue;
  timestamp?: string;
  created?: string;
};

export type AiInsight = {
  id: Id;
  deal_id: Id;
  score?: number;
  summary?: string;
  suggestions?: string;
  risks?: JsonValue;
  explainability?: JsonValue;
  model?: string;
  token_usage?: number;
  trigger_event_id?: Id;
  created_by?: Id;
  created_at?: string;
  created?: string;
};

export type PermissionCrud = { read?: boolean; create?: boolean; update?: boolean; delete?: boolean };
export type PermissionsJson = Record<string, PermissionCrud>;

export type Role = {
  id: Id;
  name: string;
  permissions_json: PermissionsJson;
};

export type TaskItem = {
  id: Id;
  title: string;
  due_at: string;
  is_done?: boolean;
  deal_id?: Id;
  company_id?: Id;
  created_by: Id;
  created?: string;
  updated?: string;
};

export type UserSummary = {
  id: Id;
  email?: string;
  name?: string;
  full_name?: string;
  role?: string;
  role_name?: string;
  created?: string;
  updated?: string;
};

export type EntityFileExpand = {
  file_id?: {
    id?: string;
    path?: string;
    filename?: string;
    mime?: string;
    size_bytes?: number;
  };
};

export type EntityFileLink = {
  id: string;
  entity_type: string;
  entity_id: string;
  file_id: string;
  tag?: string;
  created_at?: string;
  expand?: EntityFileExpand;
};

export type ContactFound = {
  id: string;
  deal_id?: string;
  company_id?: string;
  parser_run_id?: string;
  role_map_item_id?: string;
  position?: string;
  influence_type?: string;
  full_name?: string;
  phone?: string;
  telegram?: string;
  email?: string;
  source_url?: string;
  source_type?: string;
  confidence?: number;
  is_verified?: boolean;
  created?: string;
  updated?: string;
};
