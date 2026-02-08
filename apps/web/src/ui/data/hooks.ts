import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../lib/pb";
import type { Deal, Company, FunnelStage, TimelineItem, AiInsight } from "../../lib/types";
import type { PermissionMatrix } from "../../lib/rbac";

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

      const res = await pb.collection("deals").getList(1, 200, options);
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

      const res = await pb.collection("companies").getList(1, 200, options);
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

