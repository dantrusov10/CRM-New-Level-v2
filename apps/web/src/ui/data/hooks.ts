import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../lib/pb";
import type { Deal, Company, FunnelStage, TimelineItem, AiInsight, TaskItem } from "../../lib/types";
import type { PermissionMatrix } from "../../lib/rbac";

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

export type EntityFileLink = {
  id: string;
  entity_type: string;
  entity_id: string;
  file_id: string;
  tag?: string;
  created_at?: string;
  expand?: { file_id?: any };
};

function normalizeListResult<T>(res: any): T[] {
  if (!res) return [] as T[];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  return [] as T[];
}

function defaultMatrixByRole(role?: string): PermissionMatrix {
  const r = (role || "").toLowerCase();
  if (r === "admin" || r === "админ") {
    return {
      deals: { read: true, create: true, update: true, delete: true },
      companies: { read: true, create: true, update: true, delete: true },
      import_export: { read: true, create: true, update: true, delete: true },
      admin: { read: true, create: true, update: true, delete: true },
    };
  }
  if (r === "viewer" || r === "вьюер" || r === "read") {
    return {
      deals: { read: true },
      companies: { read: true },
      import_export: { read: true },
      admin: { read: false },
    };
  }
  // manager (default)
  return {
    deals: { read: true, create: true, update: true },
    companies: { read: true, create: true, update: true },
    import_export: { read: true, create: true },
    admin: { read: false },
  };
}

export function usePermissions(role?: string) {
  return useQuery({
    queryKey: ["permissions", role],
    queryFn: async (): Promise<PermissionMatrix> => {
      if (!role) return defaultMatrixByRole(role);
      // best-effort: role can be text in users; map to settings_roles.role_name
      const rec = await pb
        .collection("settings_roles")
        .getFirstListItem(`role_name="${role.replace(/"/g, "\\\"")}"`)
        .catch(() => null);
      const matrix = (rec as any)?.perms as PermissionMatrix | undefined;
      return matrix && Object.keys(matrix).length ? matrix : defaultMatrixByRole(role);
    },
    staleTime: 60_000,
  });
}

export function useFunnelStages() {
  return useQuery({
    queryKey: ["funnelStages"],
    queryFn: async (): Promise<FunnelStage[]> => {
      // PocketBase schema: stage_name + position
      const res = await pb.collection("settings_funnel_stages").getFullList({ sort: "position" });
      return res as any;
    },
  });
}

export function useDeals(params?: { search?: string; filter?: string; sort?: string }) {
  const { search, filter, sort } = params ?? {};
  // PocketBase schema: title (not name)
  const q = search ? `title~"${search.replace(/\"/g, "\\\"")}"` : "";
  const f = [filter, q].filter(Boolean).join(" && ");
  return useQuery({
    queryKey: ["deals", f, sort],
    queryFn: async (): Promise<Deal[]> => {
      // Relations in PB: company_id, stage_id, responsible_id
      const options: Record<string, any> = {
        sort: sort ?? "-updated",
        expand: "company_id,stage_id,responsible_id",
      };
      // IMPORTANT: do not send filter=undefined (PocketBase returns 400)
      if (f && String(f).trim().length) options.filter = f;

      const res = await pb.collection("deals").getFullList({ ...options, batch: 500 });
      return normalizeListResult(res) as any;
    },
  });}

/**
 * Paged list for table views (so we can render pagination UI).
 * Returns PocketBase list result: { page, perPage, totalItems, totalPages, items }.
 */
export function useDealsList(params?: { search?: string; filter?: string; sort?: string; page?: number; perPage?: number }) {
  const { search, filter, sort, page = 1, perPage = 25 } = params ?? {};
  const q = search ? `title~"${search.replace(/\"/g, "\\\"")}"` : "";
  const f = [filter, q].filter(Boolean).join(" && ");
  return useQuery({
    queryKey: ["dealsList", f, sort, page, perPage],
    queryFn: async () => {
      const options: Record<string, any> = {
        sort: sort ?? "-updated",
        expand: "company_id,stage_id,responsible_id",
      };
      if (f && String(f).trim().length) options.filter = f;
      return pb.collection("deals").getList(page, perPage, options);
    },
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: async (): Promise<any> => {
      const rec = await pb.collection("deals").getOne(id, { expand: "company_id,stage_id,responsible_id" });
      return rec;
    },
    enabled: !!id,
  });
}

export function useCompanies(params?: { search?: string; filter?: string }) {
  const q = params?.search ? `name~"${params.search}"` : "";
  const f = [params?.filter, q].filter(Boolean).join(" && ");
  return useQuery({
    queryKey: ["companies", f],
    queryFn: async (): Promise<Company[]> => {
      const options: Record<string, any> = { sort: "name" };
      // IMPORTANT: do not send filter=undefined (PocketBase returns 400)
      if (f && String(f).trim().length) options.filter = f;

      const res = await pb.collection("companies").getFullList({ ...options, batch: 500 });
      return normalizeListResult(res) as any;
    },
  });}

/** Paged companies list for table views (pagination UI). */
export function useCompaniesList(params?: { search?: string; filter?: string; page?: number; perPage?: number }) {
  const { search, filter, page = 1, perPage = 25 } = params ?? {};
  const q = search ? `name~"${search.replace(/\"/g, "\\\"")}"` : "";
  const f = [filter, q].filter(Boolean).join(" && ");
  return useQuery({
    queryKey: ["companiesList", f, page, perPage],
    queryFn: async () => {
      const options: Record<string, any> = { sort: "name" };
      if (f && String(f).trim().length) options.filter = f;
      return pb.collection("companies").getList(page, perPage, options);
    },
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["company", id],
    queryFn: async () => pb.collection("companies").getOne(id),
    enabled: !!id,
  });
}

export function useTimeline(entityType: "deal" | "company", entityId: string) {
  return useQuery({
    queryKey: ["timeline", entityType, entityId],
    queryFn: async (): Promise<TimelineItem[]> => {
      // PocketBase schema for timeline: deal_id + user_id + action + comment + payload + timestamp
      // (company timeline can be added later; for now we only support deal timeline)
      if (entityType !== "deal") return [] as any;
      const res = await pb.collection("timeline").getList(1, 200, {
        filter: `deal_id="${entityId}"`,
        sort: "-created",
        expand: "user_id",
      });
      return normalizeListResult(res) as any;
    },
    enabled: !!entityId,
  });
}

export function useAiInsights(dealId: string) {
  return useQuery({
    queryKey: ["ai_insights", dealId],
    queryFn: async (): Promise<AiInsight[]> => {
      const res = await pb.collection("ai_insights").getList(1, 50, { filter: `deal_id="${dealId}"`, sort: "-created" });
      return normalizeListResult(res) as any;
    },
    enabled: !!dealId,
  });
}

// --- Tasks (manager reminders) ---
export function useMyTasksInRange(params: { userId: string; fromIso: string; toIso: string }) {
  const { userId, fromIso, toIso } = params;
  return useQuery({
    queryKey: ["tasks", "range", userId, fromIso, toIso],
    queryFn: async (): Promise<TaskItem[]> => {
      const filter = `created_by="${userId}" && due_at>="${fromIso}" && due_at<="${toIso}"`;
      const res = await pb.collection("tasks").getList(1, 200, {
        filter,
        sort: "due_at",
        expand: "deal_id,company_id",
      });
      return normalizeListResult(res) as any;
    },
    enabled: !!userId && !!fromIso && !!toIso,
    staleTime: 15_000,
  });
}

export function useMyTasksForBell(params: { userId: string; windowHours?: number }) {
  const { userId, windowHours = 48 } = params;
  return useQuery({
    queryKey: ["tasks", "bell", userId, windowHours],
    queryFn: async (): Promise<TaskItem[]> => {
      // We fetch a small window (overdue + upcoming) and then compute counters client-side.
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000); // include overdue last 7 days
      const to = new Date(now.getTime() + windowHours * 3600 * 1000);
      const filter = `created_by="${userId}" && is_done=false && due_at>="${from.toISOString()}" && due_at<="${to.toISOString()}"`;
      const res = await pb.collection("tasks").getList(1, 200, {
        filter,
        sort: "due_at",
        expand: "deal_id,company_id",
      });
      return normalizeListResult(res) as any;
    },
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; due_at: string; deal_id?: string; company_id?: string; created_by: string }) => {
      return pb.collection("tasks").create({
        title: payload.title,
        due_at: payload.due_at,
        deal_id: payload.deal_id,
        company_id: payload.company_id,
        created_by: payload.created_by,
        is_done: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useSetTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; is_done: boolean }) => {
      return pb.collection("tasks").update(payload.id, { is_done: payload.is_done });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// --- Contacts (manual + parser results) ---
export function useContactsFound(dealId: string) {
  return useQuery({
    queryKey: ["contacts_found", dealId],
    queryFn: async (): Promise<ContactFound[]> => {
      const res = await pb
        .collection("contacts_found")
        .getList(1, 200, {
          filter: `deal_id="${dealId}"`,
          sort: "-created",
        })
        .catch(() => ({ items: [] as any[] }));
      return normalizeListResult(res) as any;
    },
    enabled: !!dealId,
  });
}

export function useCreateContactFound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ContactFound>) => {
      return pb.collection("contacts_found").create(data as any);
    },
    onSuccess: (_rec, vars) => {
      if (vars.deal_id) qc.invalidateQueries({ queryKey: ["contacts_found", vars.deal_id] });
    },
  });
}

export function useDeleteContactFound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; dealId?: string }) => {
      await pb.collection("contacts_found").delete(id);
      return { id };
    },
    onSuccess: (_rec, vars) => {
      if (vars.dealId) qc.invalidateQueries({ queryKey: ["contacts_found", vars.dealId] });
    },
  });
}

// --- Workspace files linked to an entity (deal/company/etc.) ---
export function useEntityFiles(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["entity_files", entityType, entityId],
    queryFn: async (): Promise<EntityFileLink[]> => {
      const res = await pb
        .collection("entity_files")
        .getList(1, 200, {
          filter: `entity_type="${entityType}" && entity_id="${entityId}"`,
          sort: "-created",
          expand: "file_id",
        })
        .catch(() => ({ items: [] as any[] }));
      return normalizeListResult(res) as any;
    },
    enabled: !!entityId,
  });
}

export function useAddWorkspaceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { entityType: string; entityId: string; url: string; title?: string; tag?: string }) => {
      const url = (vars.url || "").trim();
      const title = (vars.title || "").trim() || url.split("/").pop() || "file";
      const file = await pb
        .collection("files")
        .create({
          path: url,
          filename: title,
          mime: "text/uri-list",
          size_bytes: 0,
        })
        .catch(() => null);
      if (!file?.id) throw new Error("Не удалось создать files");
      const link = await pb
        .collection("entity_files")
        .create({
          entity_type: vars.entityType,
          entity_id: vars.entityId,
          file_id: file.id,
          tag: vars.tag || "",
          created_at: new Date().toISOString(),
        })
        .catch(() => null);
      if (!link?.id) throw new Error("Не удалось создать entity_files");
      return link;
    },
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ["entity_files", vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteEntityFileLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; entityType: string; entityId: string }) => {
      await pb.collection("entity_files").delete(vars.id);
      return vars;
    },
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ["entity_files", vars.entityType, vars.entityId] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const rec = await pb.collection("deals").update(id, data);
      return rec;
    },
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ["deal", vars.id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async (): Promise<any[]> => {
      // PocketBase auth collection `users`
      const res = await pb.collection("users").getFullList({ sort: "email", batch: 500 });
      return normalizeListResult(res) as any;
    },
    staleTime: 60_000,
  });
}

