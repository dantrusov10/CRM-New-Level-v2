// Minimal typing for key collections (PocketBase)
// Synced with PocketBase export (pb_schema.json) 2026-02

export type Id = string;

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
  responsible_id?: Id; // users
  created?: string;
  updated?: string;
};

export type FunnelStage = {
  id: Id;
  stage_name: string;
  position: number;
  color: string;
  active?: boolean;
  is_final?: boolean;
  final_type?: "none" | "won" | "lost";
  default_prob?: number; // % (0..100)
};

export type Deal = {
  id: Id;
  title: string;
  company_id?: Id;
  responsible_id?: Id;
  stage_id?: Id;

  // money / finance
  budget?: number;
  turnover?: number;
  margin_percent?: number;
  discount_percent?: number;

  // commercial params
  sales_channel?: string;
  partner?: string;
  distributor?: string;
  purchase_format?: string;

  // deal meta / dates
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

  // links
  project_map_link?: string;
  kaiten_link?: string;

  // AI
  current_score?: number; // 0..100
  current_recommendations?: string;

  created?: string;
  updated?: string;
};

export type TimelineItem = {
  id: Id;
  deal_id: Id;
  user_id?: Id;
  action: string;
  comment?: string;
  payload?: any;
  timestamp?: string;
  created?: string;
};

export type AiInsight = {
  id: Id;
  deal_id: Id;
  score?: number; // 0..100
  summary?: string;
  suggestions?: string;
  risks?: any;
  explainability?: string;
  model?: string;
  token_usage?: any;
  trigger_event_id?: Id;
  created_by?: Id;
  created_at?: string;
  created?: string;
};

export type Role = {
  id: Id;
  name: string;
  permissions_json: any; // {section:{read,create,update,delete}}
};

// --- Tasks (manager reminders) ---
export type TaskItem = {
  id: Id;
  title: string;
  due_at: string; // ISO datetime
  is_done?: boolean;
  deal_id?: Id;
  company_id?: Id;
  created_by: Id;
  created?: string;
  updated?: string;
};
