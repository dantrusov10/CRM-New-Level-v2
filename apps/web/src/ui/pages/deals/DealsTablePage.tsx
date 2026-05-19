import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { VisibilityState } from "@tanstack/react-table";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useDealsList, useFunnelStages, useUsers } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import { Pagination } from "../../components/Pagination";
import { Button } from "../../components/Button";
import { pb } from "../../../lib/pb";
import type { Deal, FunnelStage, UserSummary } from "../../../lib/types";
import { DealsDataTable } from "./DealsDataTable";
import { DealsTableViewsBar } from "./DealsTableViewsBar";
import { DealsFiltersModal } from "./DealsFiltersModal";
import { DealsBulkActionsModal } from "./DealsBulkActionsModal";
import { toast } from "../../../lib/toast";
import { buildDealsFilter, countActiveDealFilters } from "./dealsFilters";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const search = sp.get("search") ?? undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const filter = buildDealsFilter(sp);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const dealsQ = useDealsList({ search, filter, page, perPage: 25 });
  const stagesQ = useFunnelStages();
  const usersQ = useUsers();

  const items = (dealsQ.data?.items ?? []) as unknown as Deal[];

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const selectedCount = selected.size;
  const allPageSelected = items.length > 0 && items.every((d: Deal) => selected.has(String(d.id)));

  React.useEffect(() => {
    setSelected(new Set());
  }, [page, search, filter]);

  function toggleOne(id: string, next?: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      const has = n.has(id);
      const want = next ?? !has;
      if (want) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function togglePage(next?: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      const want = next ?? !allPageSelected;
      if (want) items.forEach((d: Deal) => n.add(String(d.id)));
      else items.forEach((d: Deal) => n.delete(String(d.id)));
      return n;
    });
  }

  async function selectAllMatching() {
    const q = search ? `title~"${esc(search)}"` : "";
    const fAll = [filter, q].filter(Boolean).join(" && ");
    const options: Record<string, unknown> = { fields: "id", batch: 500 };
    if (fAll.trim()) options.filter = fAll;
    const res = await pb.collection("deals").getFullList<Pick<Deal, "id">>(options);
    setSelected(new Set(res.map((r) => String(r.id))));
    toast.success(`Выбрано ${res.length} сделок по фильтру`);
  }

  async function bulkDelete() {
    if (!selectedCount) return;
    if (!window.confirm(`Удалить сделки: ${selectedCount} шт.?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").delete(id)));
    setSelected(new Set());
    await dealsQ.refetch();
    toast.success("Сделки удалены");
  }

  async function bulkStage(stageTo: string) {
    if (!selectedCount || !stageTo) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { stage_id: stageTo })));
    setSelected(new Set());
    await dealsQ.refetch();
    toast.success("Этап обновлён");
  }

  async function bulkOwner(ownerTo: string) {
    if (!selectedCount || !ownerTo) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { responsible_id: ownerTo })));
    setSelected(new Set());
    await dealsQ.refetch();
    toast.success("Ответственный обновлён");
  }

  const activeFilterCount = countActiveDealFilters(sp);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Сделки</div>
            <div className="text-xs text-text2 mt-1">Умная таблица: колонки, виды, фильтры по всем полям</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {search ? <Badge>поиск</Badge> : null}
            {activeFilterCount ? <Badge>фильтров: {activeFilterCount}</Badge> : null}
            <Button small variant="secondary" onClick={() => setFiltersOpen(true)}>Фильтры</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dealsQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : dealsQ.error ? (
          <div className="text-sm text-danger">Ошибка загрузки</div>
        ) : (
          <div className="overflow-auto -mx-1 px-1">
            <DealsTableViewsBar
              currentParams={sp}
              columnVisibility={columnVisibility ?? {}}
              onApplyView={(params, visibility) => {
                setSp(params, { replace: true });
                setColumnVisibility(visibility);
              }}
              onColumnVisibilityChange={setColumnVisibility}
            />

            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-text2">
                Выбрано: <span className="font-semibold text-text">{selectedCount}</span>
              </span>
              <Button small variant="secondary" onClick={() => togglePage(true)} disabled={!items.length}>Страница</Button>
              <Button small variant="secondary" onClick={selectAllMatching} disabled={dealsQ.isLoading}>Все по фильтру</Button>
              {selectedCount > 0 ? (
                <Button small variant="secondary" onClick={() => setBulkOpen(true)}>Массовые действия</Button>
              ) : null}
            </div>

            <DealsDataTable
              items={items}
              selected={selected}
              allPageSelected={allPageSelected}
              onToggleOne={toggleOne}
              onTogglePage={togglePage}
              onRowClick={(id) => nav(`/deals/${id}`)}
              visibilityOverride={columnVisibility}
              onVisibilityChange={setColumnVisibility}
            />
            {!items.length ? <div className="text-sm text-text2 py-6">Сделок пока нет.</div> : null}

            <Pagination
              page={dealsQ.data?.page ?? page}
              totalPages={dealsQ.data?.totalPages ?? 1}
              onPage={(next) => {
                const n = new URLSearchParams(sp);
                n.set("page", String(Math.max(1, next)));
                setSp(n, { replace: true });
              }}
            />
          </div>
        )}
      </CardContent>

      <DealsFiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <DealsBulkActionsModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        selectedCount={selectedCount}
        stages={(stagesQ.data ?? []) as FunnelStage[]}
        users={(usersQ.data ?? []) as UserSummary[]}
        onDelete={bulkDelete}
        onStage={bulkStage}
        onOwner={bulkOwner}
      />
    </Card>
  );
}
