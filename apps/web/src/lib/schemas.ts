import { z } from 'zod';

const idSchema = z.string().min(1);
const optionalString = z.string().optional().nullable().transform((v) => v ?? undefined);
const optionalNumber = z.number().optional().nullable().transform((v) => v ?? undefined);
const optionalBoolean = z.boolean().optional().nullable().transform((v) => v ?? undefined);

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const companySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  inn: optionalString,
  city: optionalString,
  website: optionalString,
  phone: optionalString,
  email: optionalString,
  address: optionalString,
  legal_entity: optionalString,
  responsible_id: optionalString,
  created: optionalString,
  updated: optionalString,
});

export const funnelStageSchema = z.object({
  id: idSchema,
  stage_name: z.string().min(1),
  position: z.number().catch(0),
  color: optionalString,
  active: optionalBoolean,
  is_final: optionalBoolean,
  final_type: z.enum(['none', 'won', 'lost']).optional().nullable().transform((v) => v ?? undefined),
  default_prob: optionalNumber,
});

export const dealSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  company_id: optionalString,
  responsible_id: optionalString,
  stage_id: optionalString,
  budget: optionalNumber,
  turnover: optionalNumber,
  margin_percent: optionalNumber,
  discount_percent: optionalNumber,
  sales_channel: optionalString,
  partner: optionalString,
  distributor: optionalString,
  purchase_format: optionalString,
  activity_type: optionalString,
  endpoints: optionalNumber,
  infrastructure_size: optionalString,
  presale: optionalString,
  attraction_channel: optionalString,
  attraction_date: optionalString,
  registration_deadline: optionalString,
  test_start: optionalString,
  test_end: optionalString,
  delivery_date: optionalString,
  expected_payment_date: optionalString,
  payment_received_date: optionalString,
  project_map_link: optionalString,
  kaiten_link: optionalString,
  current_score: optionalNumber,
  current_recommendations: jsonValueSchema.optional().nullable().transform((v) => v ?? undefined),
  created: optionalString,
  updated: optionalString,
});

export const timelineSchema = z.object({
  id: idSchema,
  deal_id: idSchema,
  user_id: optionalString,
  action: z.string().min(1),
  comment: optionalString,
  payload: jsonValueSchema.optional().nullable().transform((v) => v ?? undefined),
  timestamp: optionalString,
  created: optionalString,
});

export const aiInsightSchema = z.object({
  id: idSchema,
  deal_id: idSchema,
  score: optionalNumber,
  summary: optionalString,
  suggestions: optionalString,
  risks: jsonValueSchema.optional().nullable().transform((v) => v ?? undefined),
  explainability: jsonValueSchema.optional().nullable().transform((v) => v ?? undefined),
  model: optionalString,
  token_usage: optionalNumber,
  trigger_event_id: optionalString,
  created_by: optionalString,
  created_at: optionalString,
  created: optionalString,
});

export const taskSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  due_at: z.string().min(1),
  is_done: optionalBoolean,
  deal_id: optionalString,
  company_id: optionalString,
  created_by: idSchema,
  created: optionalString,
  updated: optionalString,
});

export const permissionsJsonSchema = z.record(
  z.object({
    read: z.boolean().optional(),
    create: z.boolean().optional(),
    update: z.boolean().optional(),
    delete: z.boolean().optional(),
  }),
);

export const userSummarySchema = z.object({
  id: idSchema,
  email: optionalString,
  name: optionalString,
  full_name: optionalString,
  role: optionalString,
  role_name: optionalString,
  created: optionalString,
  updated: optionalString,
});

export const entityFileLinkSchema = z.object({
  id: idSchema,
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  file_id: z.string().min(1),
  tag: optionalString,
  created_at: optionalString,
  expand: z
    .object({
      file_id: z
        .object({
          id: optionalString,
          path: optionalString,
          filename: optionalString,
          mime: optionalString,
          size_bytes: optionalNumber,
        })
        .optional(),
    })
    .optional(),
});

export const contactFoundSchema = z.object({
  id: idSchema,
  deal_id: optionalString,
  company_id: optionalString,
  parser_run_id: optionalString,
  role_map_item_id: optionalString,
  position: optionalString,
  influence_type: optionalString,
  full_name: optionalString,
  phone: optionalString,
  telegram: optionalString,
  email: optionalString,
  source_url: optionalString,
  source_type: optionalString,
  confidence: optionalNumber,
  is_verified: optionalBoolean,
  created: optionalString,
  updated: optionalString,
});

export const roleSettingsSchema = z.object({
  perms: permissionsJsonSchema.optional(),
});

export function parseOne<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}

export function parseMany<T>(schema: z.ZodSchema<T>, input: unknown[]): T[] {
  return input.map((item) => schema.parse(item));
}
