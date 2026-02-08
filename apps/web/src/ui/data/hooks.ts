import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../lib/pb";
import type { Deal, Company, FunnelStage, TimelineItem, AiInsight } from "../../lib/types";

export type ListResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
};
import type { PermissionMatrix } from "../../lib/rbac";

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

export function useDeals(params?: { search?: string; filter?: string; page?: number; perPage?: number }) {
  const q = params?.search ? `title~"${params.search}"` : "";
  const f = [params?.filter, q].filter(Boolean).join(" && ");
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 200;

  return useQuery({
    queryKey: ["deals", f, page, perPage],
    queryFn: async (): Promise<ListResult<Deal>> => {
      const options: Record<string, any> = {
        sort: "-updated",
        expand: "company_id,stage_id,responsible_id",
      };
      if (f && String(f).trim().length) options.filter = f;

      const res = await pb.collection("deals").getList(page, perPage, options);
      return {
        items: res.items as any,
        page: res.page,
        perPage: res.perPage,
        totalPages: res.totalPages,
        totalItems: res.totalItems,
      };
    },
  });
}

export function useCompanies(params?: { search?: string; filter?: string; page?: number; perPage?: number }) {
  const q = params?.search ? `name~"${params.search}"` : "";
  const f = [params?.filter, q].filter(Boolean).join(" && ");
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 50;

  return useQuery({
    queryKey: ["companies", f, page, perPage],
    queryFn: async (): Promise<ListResult<Company>> => {
      const options: Record<string, any> = { sort: "name" };
      if (f && String(f).trim().length) options.filter = f;

      const res = await pb.collection("companies").getList(page, perPage, options);
      return {
        items: res.items as any,
        page: res.page,
        perPage: res.perPage,
        totalPages: res.totalPages,
        totalItems: res.totalItems,
      };
    },
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
      return res.items as any;
    },
    enabled: !!entityId,
  });
}

export function useAiInsights(dealId: string) {
  return useQuery({
    queryKey: ["ai_insights", dealId],
    queryFn: async (): Promise<AiInsight[]> => {
      const res = await pb.collection("ai_insights").getList(1, 50, { filter: `deal_id="${dealId}"`, sort: "-created" });
      return res.items as any;
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

