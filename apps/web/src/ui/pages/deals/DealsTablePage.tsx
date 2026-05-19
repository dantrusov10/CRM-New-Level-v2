import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { VisibilityState } from "@tanstack/react-table";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useDealsList, useFunnelStages, useUsers } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import { Pagination } from "../../components/Pagination";
import { Button } from "../../components/Button";
import dayjs from "dayjs";
import { pb } from "../../../lib/pb";
import type { Deal, FunnelStage, UserSummary } from "../../../lib/types";
import { DealsDataTable } from "./DealsDataTable";
import { DealsTableViewsBar } from "./DealsTableViewsBar";
import { toast } from "../../../lib/toast";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildDealsFilter(sp: URLSearchParams) {
  const stage = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";
  const partner = sp.get("partner") ?? "";
  const distributor = sp.get("distributor") ?? "";
  const activity = sp.get("activity") ?? "";
  const budgetMin = sp.get("budgetMin") ?? "";
  const budgetMax = sp.get("budgetMax") ?? "";
  const scoreMin = sp.get("scoreMin") ?? "";
  const scoreMax = sp.get("scoreMax") ?? "";
  const endpointsMin = sp.get("endpointsMin") ?? "";
  const endpointsMax = sp.get("endpointsMax") ?? "";
  const fromIso = sp.get("from") ?? "";
  const createdFrom = fromIso ? new Date(fromIso) : null;

  return [
    stage ? `stage_id="${stage}"` : "",
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${esc(channel)}"` : "",
    partner ? `partner~"${esc(partner)}"` : "",
    distributor ? `distributor~"${esc(distributor)}"` : "",
    activity ? `activity_type~"${esc(activity)}"` : "",
    budgetMin ? `budget >= ${Number(budgetMin)}` : "",
    budgetMax ? `budget <= ${Number(budgetMax)}` : "",
    scoreMin ? `current_score >= ${Number(scoreMin)}` : "",
    scoreMax ? `current_score <= ${Number(scoreMax)}` : "",
    endpointsMin ? `endpoints >= ${Number(endpointsMin)}` : "",
    endpointsMax ? `endpoints <= ${Number(endpointsMax)}` : "",
    createdFrom ? `created >= "${dayjs(createdFrom).format("YYYY-MM-DD HH:mm:ss")}"` : "",
  ]
    .filter(Boolean)
    .join(" && ");
}

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const search = sp.get("search") ?? undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const filter = buildDealsFilter(sp);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);

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

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSp(next, { replace: true });
  }

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

  const [stageTo, setStageTo] = React.useState("");
  const [ownerTo, setOwnerTo] = React.useState("");

  async function bulkDelete() {
    if (!selectedCount) return;
    if (!window.confirm(`Удалить сделки: ${selectedCount} шт.?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").delete(id)));
    setSelected(new Set());
    await dealsQ.refetch();
    toast.success("Сделки удалены");
  }

  async function bulkStage() {
    if (!selectedCount) return;
    if (!stageTo) return toast.warning("Выбери этап");
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { stage_id: stageTo })));
    setSelected(new Set());
    setStageTo("");
    await dealsQ.refetch();
    toast.success("Этап обновлён");
  }

  async function bulkOwner() {
    if (!selectedCount) return;
    if (!ownerTo) return toast.warning("Выбери ответственного");
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { responsible_id: ownerTo })));
    setSelected(new Set());
    setOwnerTo("");
    await dealsQ.refetch();
    toast.success("Ответственный обновлён");
  }

  const activeFilterCount = ["stage", "owner", "channel", "partner", "distributor", "activity", "budgetMin", "budgetMax", "scoreMin", "scoreMax", "endpointsMin", "endpointsMax", "from"].filter(
    (k) => sp.get(k)
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Сделки</div>
            <div className="text-xs text-text2 mt-1">Умная таблица: колонки, виды, фильтры по всем полям</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {search ? <Badge>поиск</Badge> : null}
            {activeFilterCount ? <Badge>фильтров: {activeFilterCount}</Badge> : null}
            <Button small variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              {showFilters ? "Скрыть фильтры" : "Фильтры"}
            </Button>
          </div>
        </div>
        {showFilters ? (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <select className="ui-input h-9" value={sp.get("stage") ?? ""} onChange={(e) => setParam("stage", e.target.value)}>
              <option value="">Все этапы</option>
              {(stagesQ.data ?? []).map((s: FunnelStage) => (
                <option key={s.id} value={s.id}>{s.stage_name}</option>
              ))}
            </select>
            <select className="ui-input h-9" value={sp.get("owner") ?? ""} onChange={(e) => setParam("owner", e.target.value)}>
              <option value="">Все ответственные</option>
              {(usersQ.data ?? []).map((u: UserSummary) => (
                <option key={u.id} value={u.id}>{u.full_name ?? u.name ?? u.email}</option>
              ))}
            </select>
            <input className="ui-input h-9" placeholder="Канал" value={sp.get("channel") ?? ""} onChange={(e) => setParam("channel", e.target.value)} />
            <input className="ui-input h-9" placeholder="Партнёр" value={sp.get("partner") ?? ""} onChange={(e) => setParam("partner", e.target.value)} />
            <input className="ui-input h-9" placeholder="Дистрибьютор" value={sp.get("distributor") ?? ""} onChange={(e) => setParam("distributor", e.target.value)} />
            <input className="ui-input h-9" placeholder="Тип активности" value={sp.get("activity") ?? ""} onChange={(e) => setParam("activity", e.target.value)} />
            <input className="ui-input h-9" placeholder="Бюджет от" value={sp.get("budgetMin") ?? ""} onChange={(e) => setParam("budgetMin", e.target.value)} />
            <input className="ui-input h-9" placeholder="Бюджет до" value={sp.get("budgetMax") ?? ""} onChange={(e) => setParam("budgetMax", e.target.value)} />
            <input className="ui-input h-9" placeholder="AI скор от" value={sp.get("scoreMin") ?? ""} onChange={(e) => setParam("scoreMin", e.target.value)} />
            <input className="ui-input h-9" placeholder="AI скор до" value={sp.get("scoreMax") ?? ""} onChange={(e) => setParam("scoreMax", e.target.value)} />
            <input className="ui-input h-9" placeholder="Эндпоинты от" value={sp.get("endpointsMin") ?? ""} onChange={(e) => setParam("endpointsMin", e.target.value)} />
            <input className="ui-input h-9" placeholder="Эндпоинты до" value={sp.get("endpointsMax") ?? ""} onChange={(e) => setParam("endpointsMax", e.target.value)} />
            <input className="ui-input h-9" type="date" value={sp.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
            <Button small variant="ghost" onClick={() => setSp(new URLSearchParams({ page: "1" }), { replace: true })}>Сбросить фильтры</Button>
          </div>
        ) : null}
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

            <div className="mb-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 rounded-card border border-border bg-[rgba(255,255,255,0.04)] p-3">
              <div className="text-sm">
                Выбрано: <span className="font-semibold">{selectedCount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => togglePage(true)} disabled={!items.length}>Страница</Button>
                <Button variant="secondary" onClick={selectAllMatching} disabled={dealsQ.isLoading}>Все по фильтру</Button>
                <Button variant="danger" onClick={bulkDelete} disabled={!selectedCount}>Удалить</Button>
                <select className="ui-input h-9 min-w-[140px]" value={stageTo} onChange={(e) => setStageTo(e.target.value)}>
                  <option value="">Этап…</option>
                  {(stagesQ.data ?? []).map((s: FunnelStage) => (
                    <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={bulkStage} disabled={!selectedCount}>Этап</Button>
                <select className="ui-input h-9 min-w-[140px]" value={ownerTo} onChange={(e) => setOwnerTo(e.target.value)}>
                  <option value="">Ответственный…</option>
                  {(usersQ.data ?? []).map((u: UserSummary) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={bulkOwner} disabled={!selectedCount}>Ответственный</Button>
              </div>
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
    </Card>
  );
}
