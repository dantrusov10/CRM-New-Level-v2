import { z } from "zod";
import { pb, getAuthUser } from "./pb";
import {
  aiInsightSchema,
  companySchema,
  dealSchema,
  fieldValueRowSchema,
  funnelStageSchema,
  relationOptionSchema,
  settingsFieldSchema,
  settingsSectionSchema,
  taskItemSchema,
  timelineItemSchema,
  userSummarySchema,
} from "./schemas";
import type {
  AiInsight,
  Company,
  Deal,
  FunnelStage,
  RelationOption,
  TaskItem,
  TimelineItem,
  UserSummary,
} from "./types";
import type { FieldValueRow, SettingsField, SettingsSection } from "./entityForm";

function parseMany<T>(schema: z.ZodType<T>, value: unknown): T[] {
  return z.array(schema).catch([]).parse(value);
}

function escapeFilter(input: string): string {
  return input.replace(/\/g, "\\").replace(/"/g, '\"');
}

function addOwnershipFilter(base?: string): string | undefined {
  const auth = getAuthUser();
  const role = (auth?.role || auth?.role_name || "").toLowerCase();
  if (!auth?.id || role === "admin" || role === "админ") return base;
  const own = `responsible_id="${escapeFilter(auth.id)}"`;
  return [base, own].filter(Boolean).join(" && ") || own;
}

export const api = {
  users: {
    async list(): Promise<UserSummary[]> {
      const res = await pb.collection("users").getFullList({ sort: "email" });
      return parseMany(userSummarySchema, res);
    },
  },
  funnelStages: {
    async list(): Promise<FunnelStage[]> {
      const res = await pb.collection("settings_funnel_stages").getFullList({ sort: "position" });
      return parseMany(funnelStageSchema, res);
    },
  },
  deals: {
    async list(params?: { filter?: string; search?: string; sort?: string }): Promise<Deal[]> {
      const search = params?.search ? `title~"${escapeFilter(params.search)}"` : "";
      const filter = addOwnershipFilter([params?.filter, search].filter(Boolean).join(" && "));
      const res = await pb.collection("deals").getFullList({
        sort: params?.sort ?? "-updated",
        expand: "company_id,stage_id,responsible_id",
        ...(filter ? { filter } : {}),
        batch: 500,
      });
      return parseMany(dealSchema, res);
    },
    async paged(params?: { filter?: string; search?: string; sort?: string; page?: number; perPage?: number }) {
      const search = params?.search ? `title~"${escapeFilter(params.search)}"` : "";
      const filter = addOwnershipFilter([params?.filter, search].filter(Boolean).join(" && "));
      const res = await pb.collection("deals").getList(params?.page ?? 1, params?.perPage ?? 25, {
        sort: params?.sort ?? "-updated",
        expand: "company_id,stage_id,responsible_id",
        ...(filter ? { filter } : {}),
      });
      return { ...res, items: parseMany(dealSchema, res.items) };
    },
    async get(id: string): Promise<Deal> {
      const rec = await pb.collection("deals").getOne(id, { expand: "company_id,stage_id,responsible_id" });
      return dealSchema.parse(rec);
    },
  },
  companies: {
    async list(params?: { filter?: string; search?: string }): Promise<Company[]> {
      const search = params?.search ? `name~"${escapeFilter(params.search)}"` : "";
      const filter = addOwnershipFilter([params?.filter, search].filter(Boolean).join(" && "));
      const res = await pb.collection("companies").getFullList({ sort: "name", ...(filter ? { filter } : {}), batch: 500 });
      return parseMany(companySchema, res);
    },
    async paged(params?: { filter?: string; search?: string; page?: number; perPage?: number }) {
      const search = params?.search ? `name~"${escapeFilter(params.search)}"` : "";
      const filter = addOwnershipFilter([params?.filter, search].filter(Boolean).join(" && "));
      const res = await pb.collection("companies").getList(params?.page ?? 1, params?.perPage ?? 25, { sort: "name", ...(filter ? { filter } : {}) });
      return { ...res, items: parseMany(companySchema, res.items) };
    },
    async get(id: string): Promise<Company> {
      const rec = await pb.collection("companies").getOne(id);
      return companySchema.parse(rec);
    },
  },
  timeline: {
    async listForDeal(dealId: string): Promise<TimelineItem[]> {
      const res = await pb.collection("timeline").getList(1, 200, { filter: `deal_id="${escapeFilter(dealId)}"`, sort: "-created", expand: "user_id" });
      return parseMany(timelineItemSchema, res.items);
    },
  },
  aiInsights: {
    async listForDeal(dealId: string): Promise<AiInsight[]> {
      const res = await pb.collection("ai_insights").getList(1, 50, { filter: `deal_id="${escapeFilter(dealId)}"`, sort: "-created" });
      return parseMany(aiInsightSchema, res.items);
    },
  },
  tasks: {
    async listRange(userId: string, fromIso: string, toIso: string): Promise<TaskItem[]> {
      const filter = `created_by="${escapeFilter(userId)}" && due_at>="${escapeFilter(fromIso)}" && due_at<="${escapeFilter(toIso)}"`;
      const res = await pb.collection("tasks").getList(1, 200, { filter, sort: "due_at", expand: "deal_id,company_id" });
      return parseMany(taskItemSchema, res.items);
    },
    async listBell(userId: string, windowHours = 48): Promise<TaskItem[]> {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const to = new Date(now.getTime() + windowHours * 3600 * 1000);
      const filter = `created_by="${escapeFilter(userId)}" && is_done=false && due_at>="${from.toISOString()}" && due_at<="${to.toISOString()}"`;
      const res = await pb.collection("tasks").getList(1, 200, { filter, sort: "due_at", expand: "deal_id,company_id" });
      return parseMany(taskItemSchema, res.items);
    },
  },
  dynamicForms: {
    async sections(entity: "company" | "deal"): Promise<SettingsSection[]> {
      const res = await pb.collection("settings_field_sections").getFullList({ filter: `entity_type="${escapeFilter(entity)}"`, sort: "order" });
      return parseMany(settingsSectionSchema, res);
    },
    async fields(entity: "company" | "deal"): Promise<SettingsField[]> {
      const res = await pb.collection("settings_fields").getFullList({ filter: `entity_type="${escapeFilter(entity)}"`, sort: "order,sort_order" });
      return parseMany(settingsFieldSchema, res);
    },
    async values(entity: "company" | "deal", recordId: string): Promise<FieldValueRow[]> {
      const collection = entity === "company" ? "company_field_values" : "deal_field_values";
      const field = entity === "company" ? "company_id" : "deal_id";
      const res = await pb.collection(collection).getFullList({ filter: `${field}="${escapeFilter(recordId)}"` });
      return parseMany(fieldValueRowSchema, res);
    },
    async relationOptions(collectionName: string): Promise<RelationOption[]> {
      const res = await pb.collection(collectionName).getList(1, 200, { sort: "-created" });
      return parseMany(relationOptionSchema, res.items);
    },
  },
};
