import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pb } from '../../lib/pb';
import type {
  AiInsight,
  Company,
  ContactFound,
  Deal,
  EntityFileLink,
  FunnelStage,
  TaskItem,
  TimelineItem,
  UserSummary,
} from '../../lib/types';
import type { PermissionMatrix } from '../../lib/rbac';
import {
  aiInsightSchema,
  companySchema,
  contactFoundSchema,
  dealSchema,
  entityFileLinkSchema,
  funnelStageSchema,
  parseMany,
  parseOne,
  permissionsJsonSchema,
  taskSchema,
  timelineSchema,
  userSummarySchema,
} from '../../lib/schemas';
import { getOneParsed, listAllParsed, listPageParsed, type PbListResult } from '../../lib/api/pbCollection';

function buildContainsFilter(field: string, value?: string) {
  if (!value) return '';
  return `${field}~"${value.replace(/"/g, '\\"')}"`;
}

function joinFilters(...parts: Array<string | undefined>) {
  return parts.filter((part) => part && part.trim().length).join(' && ');
}

function defaultMatrixByRole(role?: string): PermissionMatrix {
  const r = (role || '').toLowerCase();
  if (r === 'admin' || r === 'админ') {
    return {
      deals: { read: true, create: true, update: true, delete: true },
      companies: { read: true, create: true, update: true, delete: true },
      import_export: { read: true, create: true, update: true, delete: true },
      admin: { read: true, create: true, update: true, delete: true },
    };
  }
  if (r === 'viewer' || r === 'вьюер' || r === 'read') {
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
    queryKey: ['permissions', role],
    queryFn: async (): Promise<PermissionMatrix> => {
      if (!role) return defaultMatrixByRole(role);
      const safeRole = role.replace(/"/g, '\\"');
      const rec = await pb.collection('settings_roles').getFirstListItem(`role_name="${safeRole}"`).catch(() => null);
      if (!rec) return defaultMatrixByRole(role);
      const permsRaw = typeof rec === 'object' && rec !== null ? (rec as { perms?: unknown }).perms : undefined;
      const parsed = permissionsJsonSchema.safeParse(permsRaw);
      return parsed.success && Object.keys(parsed.data).length ? parsed.data : defaultMatrixByRole(role);
    },
    staleTime: 60_000,
  });
}

export function useFunnelStages() {
  return useQuery({
    queryKey: ['funnelStages'],
    queryFn: async (): Promise<FunnelStage[]> => listAllParsed('settings_funnel_stages', funnelStageSchema, { sort: 'position' }),
  });
}

export function useDeals(params?: { search?: string; filter?: string; sort?: string }) {
  const { search, filter, sort } = params ?? {};
  const finalFilter = joinFilters(filter, buildContainsFilter('title', search));
  return useQuery({
    queryKey: ['deals', finalFilter, sort],
    queryFn: async (): Promise<Deal[]> =>
      listAllParsed('deals', dealSchema, {
        sort: sort ?? '-updated',
        expand: 'company_id,stage_id,responsible_id',
        ...(finalFilter ? { filter: finalFilter } : {}),
      }),
  });
}

export function useDealsList(params?: { search?: string; filter?: string; sort?: string; page?: number; perPage?: number }) {
  const { search, filter, sort, page = 1, perPage = 25 } = params ?? {};
  const finalFilter = joinFilters(filter, buildContainsFilter('title', search));
  return useQuery({
    queryKey: ['dealsList', finalFilter, sort, page, perPage],
    queryFn: async (): Promise<PbListResult<Deal>> =>
      listPageParsed('deals', dealSchema, page, perPage, {
        sort: sort ?? '-updated',
        expand: 'company_id,stage_id,responsible_id',
        ...(finalFilter ? { filter: finalFilter } : {}),
      }),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: async (): Promise<Deal> => getOneParsed('deals', id, dealSchema, { expand: 'company_id,stage_id,responsible_id' }),
    enabled: !!id,
  });
}

export function useCompanies(params?: { search?: string; filter?: string }) {
  const finalFilter = joinFilters(params?.filter, buildContainsFilter('name', params?.search));
  return useQuery({
    queryKey: ['companies', finalFilter],
    queryFn: async (): Promise<Company[]> =>
      listAllParsed('companies', companySchema, {
        sort: 'name',
        ...(finalFilter ? { filter: finalFilter } : {}),
      }),
  });
}

export function useCompaniesList(params?: { search?: string; filter?: string; page?: number; perPage?: number }) {
  const { search, filter, page = 1, perPage = 25 } = params ?? {};
  const finalFilter = joinFilters(filter, buildContainsFilter('name', search));
  return useQuery({
    queryKey: ['companiesList', finalFilter, page, perPage],
    queryFn: async (): Promise<PbListResult<Company>> =>
      listPageParsed('companies', companySchema, page, perPage, {
        sort: 'name',
        ...(finalFilter ? { filter: finalFilter } : {}),
      }),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: async (): Promise<Company> => getOneParsed('companies', id, companySchema),
    enabled: !!id,
  });
}

export function useTimeline(entityType: 'deal' | 'company', entityId: string) {
  return useQuery({
    queryKey: ['timeline', entityType, entityId],
    queryFn: async (): Promise<TimelineItem[]> => {
      if (entityType !== 'deal') return [];
      const result = await pb.collection('timeline').getList(1, 200, {
        filter: `deal_id="${entityId}"`,
        sort: '-created',
        expand: 'user_id',
      });
      return parseMany(timelineSchema, result.items);
    },
    enabled: !!entityId,
  });
}

export function useAiInsights(dealId: string) {
  return useQuery({
    queryKey: ['ai_insights', dealId],
    queryFn: async (): Promise<AiInsight[]> => {
      const result = await pb.collection('ai_insights').getList(1, 50, { filter: `deal_id="${dealId}"`, sort: '-created' });
      return parseMany(aiInsightSchema, result.items);
    },
    enabled: !!dealId,
  });
}

export function useMyTasksInRange(params: { userId: string; fromIso: string; toIso: string }) {
  const { userId, fromIso, toIso } = params;
  return useQuery({
    queryKey: ['tasks', 'range', userId, fromIso, toIso],
    queryFn: async (): Promise<TaskItem[]> => {
      const result = await pb.collection('tasks').getList(1, 200, {
        filter: `created_by="${userId}" && due_at>="${fromIso}" && due_at<="${toIso}"`,
        sort: 'due_at',
        expand: 'deal_id,company_id',
      });
      return parseMany(taskSchema, result.items);
    },
    enabled: !!userId && !!fromIso && !!toIso,
    staleTime: 15_000,
  });
}

export function useMyTasksForBell(params: { userId: string; windowHours?: number }) {
  const { userId, windowHours = 48 } = params;
  return useQuery({
    queryKey: ['tasks', 'bell', userId, windowHours],
    queryFn: async (): Promise<TaskItem[]> => {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const to = new Date(now.getTime() + windowHours * 3600 * 1000);
      const result = await pb.collection('tasks').getList(1, 200, {
        filter: `created_by="${userId}" && is_done=false && due_at>="${from.toISOString()}" && due_at<="${to.toISOString()}"`,
        sort: 'due_at',
        expand: 'deal_id,company_id',
      });
      return parseMany(taskSchema, result.items);
    },
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; due_at: string; deal_id?: string; company_id?: string; created_by: string }) =>
      pb.collection('tasks').create({
        title: payload.title,
        due_at: payload.due_at,
        deal_id: payload.deal_id,
        company_id: payload.company_id,
        created_by: payload.created_by,
        is_done: false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useSetTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; is_done: boolean }) => pb.collection('tasks').update(payload.id, { is_done: payload.is_done }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useContactsFound(dealId: string) {
  return useQuery({
    queryKey: ['contacts_found', dealId],
    queryFn: async (): Promise<ContactFound[]> => {
      const result = await pb
        .collection('contacts_found')
        .getList(1, 200, {
          filter: `deal_id="${dealId}"`,
          sort: '-created',
        })
        .catch(() => ({ items: [] as unknown[] }));
      return parseMany(contactFoundSchema, result.items);
    },
    enabled: !!dealId,
  });
}

export function useCreateContactFound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ContactFound>) => pb.collection('contacts_found').create(data),
    onSuccess: (_rec, vars) => {
      if (vars.deal_id) qc.invalidateQueries({ queryKey: ['contacts_found', vars.deal_id] });
    },
  });
}

export function useDeleteContactFound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; dealId?: string }) => {
      await pb.collection('contacts_found').delete(id);
      return { id };
    },
    onSuccess: (_rec, vars) => {
      if (vars.dealId) qc.invalidateQueries({ queryKey: ['contacts_found', vars.dealId] });
    },
  });
}

export function useEntityFiles(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['entity_files', entityType, entityId],
    queryFn: async (): Promise<EntityFileLink[]> => {
      const result = await pb
        .collection('entity_files')
        .getList(1, 200, {
          filter: `entity_type="${entityType}" && entity_id="${entityId}"`,
          sort: '-created',
          expand: 'file_id',
        })
        .catch(() => ({ items: [] as unknown[] }));
      return parseMany(entityFileLinkSchema, result.items);
    },
    enabled: !!entityId,
  });
}

export function useAddWorkspaceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { entityType: string; entityId: string; url: string; title?: string; tag?: string }) => {
      const url = vars.url.trim();
      const title = vars.title?.trim() || url.split('/').pop() || 'file';
      const file = await pb.collection('files').create({
        path: url,
        filename: title,
        mime: 'text/uri-list',
        size_bytes: 0,
      });
      const fileId = typeof file === 'object' && file !== null ? (file as { id?: string }).id : undefined;
      if (!fileId) throw new Error('Не удалось создать files');

      const link = await pb.collection('entity_files').create({
        entity_type: vars.entityType,
        entity_id: vars.entityId,
        file_id: fileId,
        tag: vars.tag || '',
        created_at: new Date().toISOString(),
      });
      const linkId = typeof link === 'object' && link !== null ? (link as { id?: string }).id : undefined;
      if (!linkId) throw new Error('Не удалось создать entity_files');
      return link;
    },
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ['entity_files', vars.entityType, vars.entityId] });
    },
  });
}

export function useDeleteEntityFileLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; entityType: string; entityId: string }) => {
      await pb.collection('entity_files').delete(vars.id);
      return vars;
    },
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ['entity_files', vars.entityType, vars.entityId] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Deal> }) => pb.collection('deals').update(id, data),
    onSuccess: (_rec, vars) => {
      qc.invalidateQueries({ queryKey: ['deal', vars.id] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['dealsList'] });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserSummary[]> => {
      const result = await pb.collection('users').getFullList({ sort: 'email', batch: 500 });
      return parseMany(userSummarySchema, result);
    },
    staleTime: 60_000,
  });
}
