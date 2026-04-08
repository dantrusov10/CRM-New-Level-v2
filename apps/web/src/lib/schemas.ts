import { z } from "zod";

export const userSummarySchema = z.object({
  id: z.string(),
  email: z.string().optional().default(""),
  name: z.string().optional(),
  full_name: z.string().optional(),
  role: z.string().optional(),
  role_name: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export const companySchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  inn: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  legal_entity: z.string().optional(),
  responsible_id: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export const funnelStageSchema = z.object({
  id: z.string(),
  stage_name: z.string().default(""),
  position: z.coerce.number().default(0),
  color: z.string().default("#CBD5E1"),
  active: z.boolean().optional(),
  is_final: z.boolean().optional(),
  final_type: z.enum(["none", "won", "lost"]).optional(),
  default_prob: z.coerce.number().optional(),
});

export const dealSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  company_id: z.string().optional(),
  responsible_id: z.string().optional(),
  stage_id: z.string().optional(),
  budget: z.coerce.number().optional(),
  turnover: z.coerce.number().optional(),
  margin_percent: z.coerce.number().optional(),
  discount_percent: z.coerce.number().optional(),
  sales_channel: z.string().optional(),
  partner: z.string().optional(),
  distributor: z.string().optional(),
  purchase_format: z.string().optional(),
  activity_type: z.string().optional(),
  endpoints: z.coerce.number().optional(),
  infrastructure_size: z.string().optional(),
  presale: z.string().optional(),
  attraction_channel: z.string().optional(),
  attraction_date: z.string().optional(),
  registration_deadline: z.string().optional(),
  test_start: z.string().optional(),
  test_end: z.string().optional(),
  delivery_date: z.string().optional(),
  expected_payment_date: z.string().optional(),
  payment_received_date: z.string().optional(),
  project_map_link: z.string().optional(),
  kaiten_link: z.string().optional(),
  current_score: z.coerce.number().optional(),
  current_recommendations: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  expand: z.object({
    company_id: companySchema.optional(),
    stage_id: funnelStageSchema.optional(),
    responsible_id: userSummarySchema.optional(),
  }).partial().optional(),
});

export const timelineItemSchema = z.object({
  id: z.string(),
  deal_id: z.string(),
  user_id: z.string().optional(),
  action: z.string().default(""),
  comment: z.string().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  timestamp: z.string().optional(),
  created: z.string().optional(),
});

export const aiInsightSchema = z.object({
  id: z.string(),
  deal_id: z.string(),
  score: z.coerce.number().optional(),
  summary: z.string().optional(),
  suggestions: z.string().optional(),
  risks: z.record(z.unknown()).nullable().optional(),
  explainability: z.string().optional(),
  model: z.string().optional(),
  token_usage: z.record(z.unknown()).nullable().optional(),
  trigger_event_id: z.string().optional(),
  created_by: z.string().optional(),
  created_at: z.string().optional(),
  created: z.string().optional(),
});

export const taskItemSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  due_at: z.string(),
  is_done: z.boolean().optional(),
  deal_id: z.string().optional(),
  company_id: z.string().optional(),
  created_by: z.string(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export const relationOptionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().optional(),
}).catchall(z.unknown());

export const settingsFieldSchema = z.object({
  id: z.string(),
  collection: z.string().optional(),
  field_name: z.string().default(""),
  label: z.string().default(""),
  field_type: z.string().default("text"),
  value_type: z.string().optional(),
  required: z.boolean().optional(),
  visible: z.boolean().optional(),
  options: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),
  section_id: z.string().optional(),
  order: z.coerce.number().optional(),
  sort_order: z.coerce.number().optional(),
  system: z.boolean().optional(),
  help_text: z.string().optional(),
});

export const settingsSectionSchema = z.object({
  id: z.string(),
  entity_type: z.enum(["company", "deal"]),
  key: z.string().default("default"),
  title: z.string().default("Основное"),
  order: z.coerce.number().optional(),
  collapsed: z.boolean().optional(),
});

export const fieldValueRowSchema = z.object({
  id: z.string(),
  field_id: z.string(),
  value_text: z.string().nullable().optional(),
  value_number: z.coerce.number().nullable().optional(),
  value_date: z.string().nullable().optional(),
  value_json: z.unknown().optional(),
});

export function parseWithSchemaArray<T>(schema: z.ZodType<T>, value: unknown): T[] {
  return z.array(schema).safeParse(value).success ? z.array(schema).parse(value) : [];
}
