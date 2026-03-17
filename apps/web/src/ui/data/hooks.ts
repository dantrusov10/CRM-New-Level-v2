import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../lib/pb";
import { api } from "../../lib/api";
import type { Deal, Company, FunnelStage, TimelineItem, AiInsight, TaskItem, UserSummary } from "../../lib/types";
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
  expand?: { file_id?: Record<string, unknown> | null };
};

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
      const rec = await pb.collection("settings_roles").getFirstListItem(`role_name="${role.replace(/"/g, "\"")}"`).catch(() => null);
      const matrix = (rec as { perms?: PermissionMatrix } | null)?.perms;
      return matrix && Object.keys(matrix).length ? matrix : defaultMatrixByRole(role);
    },
    staleTime: 60_000,
  });
}

export function useFunnelStages() {
  return useQuery({ queryKey: ["funnelStages"], queryFn: () => api.funnelStages.list() });
}

export function useDeals(params?: { search?: string; filter?: string; sort?: string }) {
  return useQuery({
    queryKey: ["deals", params?.search, params?.filter, params?.sort],
    queryFn: (): Promise<Deal[]> => api.deals.list(params),
  });
}

export function useDealsList(params?: { search?: string; filter?: string; sort?: string; page?: number; perPage?: number }) {
  return useQuery({
    queryKey: ["dealsList", params?.search, params?.filter, params?.sort, params?.page, params?.perPage],
    queryFn: () => api.deals.paged(params),
  });
}

export function useDeal(id: string) {
  return useQuery({ queryKey: ["deal", id], queryFn: (): Promise<Deal> => api.deals.get(id), enabled: !!id });
}

export function useCompanies(params?: { search?: string; filter?: string }) {
  return useQuery({ queryKey: ["companies", params?.search, params?.filter], queryFn: (): Promise<Company[]> => api.companies.list(params) });
}

export function useCompaniesList(params?: { search?: string; filter?: string; page?: number; perPage?: number }) {
  return useQuery({
    queryKey: ["companiesList", params?.search, params?.filter, params?.page, params?.perPage],
    queryFn: () => api.companies.paged(params),
  });
}

export function useCompany(id: string) {
  return useQuery({ queryKey: ["company", id], queryFn: (): Promise<Company> => api.companies.get(id), enabled: !!id });
}

export function useTimeline(entityType: "deal" | "company", entityId: string) {
  return useQuery({
    queryKey: ["timeline", entityType, entityId],
    queryFn: async (): Promise<TimelineItem[]> => (entityType === "deal" ? api.timeline.listForDeal(entityId) : []),
    enabled: !!entityId,
  });
}

export function useAiInsights(dealId: string) {
  return useQuery({ queryKey: ["ai_insights", dealId], queryFn: (): Promise<AiInsight[]> => api.aiInsights.listForDeal(dealId), enabled: !!dealId });
}

export function useMyTasksInRange(params: { userId: string; fromIso: string; toIso: string }) {
  const { userId, fromIso, toIso } = params;
  return useQuery({
    queryKey: ["tasks", "range", userId, fromIso, toIso],
    queryFn: (): Promise<TaskItem[]> => api.tasks.listRange(userId, fromIso, toIso),
    enabled: !!userId && !!fromIso && !!toIso,
    staleTime: 15_000,
  });
}

export function useMyTasksForBell(params: { userId: string; windowHours?: number }) {
  const { userId, windowHours = 48 } = params;
  return useQuery({
    queryKey: ["tasks", "bell", userId, windowHours],
    queryFn: (): Promise<TaskItem[]> => api.tasks.listBell(userId, windowHours),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: (): Promise<UserSummary[]> => api.users.list(), staleTime: 60_000 });
}

export function useEntityFiles(entityType: "deal" | "company", entityId: string) {
  return useQuery({
    queryKey: ["entityFiles", entityType, entityId],
    queryFn: async (): Promise<EntityFileLink[]> => {
      const res = await pb.collection("entity_files").getFullList({ filter: `entity_type="${entityType}" && entity_id="${entityId}"`, expand: "file_id", sort: "-created" }).catch(() => []);
      return Array.isArray(res) ? (res as EntityFileLink[]) : [];
    },
    enabled: !!entityId,
  });
}

export function useContactsFound(params: { dealId?: string; companyId?: string }) {
  const { dealId, companyId } = params;
  return useQuery({
    queryKey: ["contactsFound", dealId, companyId],
    queryFn: async (): Promise<ContactFound[]> => {
      const filters = [dealId ? `deal_id="${dealId}"` : "", companyId ? `company_id="${companyId}"` : ""].filter(Boolean).join(" && ");
      if (!filters) return [];
      const res = await pb.collection("contacts_found").getFullList({ filter: filters, sort: "-created" }).catch(() => []);
      return Array.isArray(res) ? (res as ContactFound[]) : [];
    },
    enabled: Boolean(dealId || companyId),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Deal> }) => pb.collection("deals").update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["deal", vars.id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dealsList"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
