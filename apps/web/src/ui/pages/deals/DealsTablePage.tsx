import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useDealsList, useFunnelStages, useUsers } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import { Pagination } from "../../components/Pagination";
import { Button } from "../../components/Button";
import dayjs from "dayjs";
import { pb } from "../../../lib/pb";
import type { Deal, FunnelStage, UserSummary } from "../../../lib/types";

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const search = sp.get("search") ?? undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const stage = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";
  const budgetMin = sp.get("budgetMin") ?? "";
  const budgetMax = sp.get("budgetMax") ?? "";
  const scoreMin = sp.get("scoreMin") ?? "";
  const scoreMax = sp.get("scoreMax") ?? "";
  const fromIso = sp.get("from") ?? "";

  // PocketBase filter uses datetime strings; keep it simple with ISO.
  const createdFrom = fromIso ? new Date(fromIso) : null;

  const filter = [
    // PocketBase schema
    stage ? `stage_id="${stage}"` : "",
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/\"/g, "\\\"")}"` : "",
    budgetMin ? `budget >= ${Number(budgetMin)}` : "",
    budgetMax ? `budget <= ${Number(budgetMax)}` : "",
    scoreMin ? `current_score >= ${Number(scoreMin)}` : "",
    scoreMax ? `current_score <= ${Number(scoreMax)}` : "",
    createdFrom ? `created >= "${dayjs(createdFrom).format("YYYY-MM-DD HH:mm:ss")}"` : "",
  ].filter(Boolean).join(" && ");

  const dealsQ = useDealsList({ search, filter, page, perPage: 25 });
  const stagesQ = useFunnelStages();
  const usersQ = useUsers();

  const items = dealsQ.data?.items ?? [];

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const selectedCount = selected.size;
  const allPageSelected = items.length > 0 && items.every((d: Deal) => selected.has(String(d.id)));

  React.useEffect(() => {
    // If page/search/filter changes → reset selection (avoid accidental bulk operations)
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
    // selects all deals matching current filters + search
    const q = search ? `title~"${search.replace(/\"/g, "\\\"")}"` : "";
    const fAll = [filter, q].filter(Boolean).join(" && ");
    const options: Record<string, unknown> = { fields: "id", batch: 500 };
    if (fAll && String(fAll).trim().length) options.filter = fAll;
    const res = await pb.collection("deals").getFullList<Pick<Deal, "id">>(options);
    const ids = res.map((r) => String(r.id));
    setSelected(new Set(ids));
  }

  const [stageTo, setStageTo] = React.useState("");
  const [ownerTo, setOwnerTo] = React.useState("");

  async function bulkDelete() {
    if (!selectedCount) return;
    if (!confirm(`Удалить сделки: ${selectedCount} шт.?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").delete(id)));
    setSelected(new Set());
    await dealsQ.refetch();
  }

  async function bulkStage() {
    if (!selectedCount) return;
    if (!stageTo) return alert("Выбери этап");
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { stage_id: stageTo })));
    setSelected(new Set());
    setStageTo("");
    await dealsQ.refetch();
  }

  async function bulkOwner() {
    if (!selectedCount) return;
    if (!ownerTo) return alert("Выбери ответственного");
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("deals").update(id, { responsible_id: ownerTo })));
    setSelected(new Set());
    setOwnerTo("");
    await dealsQ.refetch();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-base font-extrabold tracking-wide">Deals list / pipeline</div>
            <div className="text-xs text-text2 mt-1">Быстрый список для ежедневной работы менеджера: фильтр → выбор → массовое действие</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {search ? <Badge>поиск: {search}</Badge> : null}
            {stage ? <Badge>этап</Badge> : null}
            {owner ? <Badge>ответственный</Badge> : null}
            {channel ? <Badge>канал: {channel}</Badge> : null}
            {fromIso ? <Badge>период</Badge> : null}
            <span className="rounded-md border border-[rgba(87,183,255,0.35)] bg-[rgba(45,123,255,0.18)] px-3 py-1 text-xs font-semibold text-text">Operational view</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dealsQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : dealsQ.error ? (
          <div className="text-sm text-danger">Ошибка загрузки</div>
        ) : (
          <div className="overflow-auto">
            <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#14345b] p-3">
                <div className="text-xs text-text2">Сделок на странице</div>
                <div className="mt-1 text-lg font-semibold">{items.length}</div>
              </div>
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#123053] p-3">
                <div className="text-xs text-text2">Выбрано для массовых действий</div>
                <div className="mt-1 text-lg font-semibold">
                  {selectedCount}
                  {selectedCount > 0 && selectedCount === items.length ? <span className="text-sm text-text2"> (вся страница)</span> : null}
                </div>
              </div>
              <div className="rounded-card border border-[rgba(87,183,255,0.24)] bg-[#102947] p-3">
                <div className="text-xs text-text2">Текущий режим</div>
                <div className="mt-1 text-sm font-semibold">{search || stage || owner || channel ? "Фильтрованный список" : "Все сделки"}</div>
              </div>
            </div>

            {/* Bulk actions bar (always visible so it’s obvious) */}
            <div className="mb-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 rounded-card border border-border bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => togglePage(true)} disabled={!items.length}>Выбрать страницу</Button>
                <Button variant="secondary" onClick={selectAllMatching} disabled={dealsQ.isLoading}>Выбрать все по фильтру</Button>
                <div className="w-px h-6 bg-border mx-1" />

                <Button variant="danger" onClick={bulkDelete} disabled={!selectedCount}>Удалить</Button>
                <div className="flex items-center gap-2">
                  <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={stageTo} onChange={(e) => setStageTo(e.target.value)}>
                    <option value="">Сменить этап…</option>
                    {(stagesQ.data ?? []).map((s: FunnelStage) => (
                      <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={bulkStage} disabled={!selectedCount}>Применить</Button>
                </div>
                <div className="flex items-center gap-2">
                  <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={ownerTo} onChange={(e) => setOwnerTo(e.target.value)}>
                    <option value="">Сменить ответственного…</option>
                    {(usersQ.data ?? []).map((u: UserSummary) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={bulkOwner} disabled={!selectedCount}>Применить</Button>
                </div>
              </div>
            </div>

            <table className="min-w-[1100px] w-full text-sm rounded-card overflow-hidden">
              <thead>
                <tr className="h-10 bg-[rgba(17,24,39,0.52)] text-[#374151] font-semibold">
                  <th className="text-left px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(e) => togglePage(e.target.checked)}
                      aria-label="Выбрать все на странице"
                    />
                  </th>
                  <th className="text-left px-3">Сделка</th>
                  <th className="text-left px-3">Компания</th>
                  <th className="text-left px-3">Ответственный</th>
                  <th className="text-left px-3">Этап</th>
                  <th className="text-right px-3">Бюджет</th>
                  <th className="text-right px-3">Оборот</th>
                  <th className="text-right px-3">Маржа %</th>
                  <th className="text-left px-3">Канал</th>
                  <th className="text-left px-3">Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d: Deal) => (
                  <tr
                    key={d.id}
                    className="h-11 border-b border-border hover:bg-[rgba(51,215,255,0.12)] cursor-pointer transition-colors"
                    onClick={() => nav(`/deals/${d.id}`)}
                  >
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(String(d.id))} onChange={(e) => toggleOne(String(d.id), e.target.checked)} aria-label="Выбрать сделку" />
                    </td>
                    <td className="px-3 font-medium">
                      <div className="max-w-[280px] truncate">{d.title}</div>
                    </td>
                    <td className="px-3 text-text2">{d.expand?.company_id?.name ?? "—"}</td>
                    <td className="px-3 text-text2">{d.expand?.responsible_id?.full_name ?? d.expand?.responsible_id?.email ?? "—"}</td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.expand?.stage_id?.color ?? "#9CA3AF" }} />
                        <span className="text-text2">{d.expand?.stage_id?.stage_name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 text-right tabular-nums">{d.budget ? d.budget.toLocaleString("ru-RU") : "—"}</td>
                    <td className="px-3 text-right tabular-nums">{d.turnover ? d.turnover.toLocaleString("ru-RU") : "—"}</td>
                    <td className="px-3 text-right tabular-nums">{typeof d.margin_percent === "number" ? `${d.margin_percent}%` : "—"}</td>
                    <td className="px-3 text-text2">{d.sales_channel ?? "—"}</td>
                    <td className="px-3 text-text2">{d.updated ? dayjs(d.updated).format("DD.MM.YYYY HH:mm") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(dealsQ.data?.items ?? []).length ? <div className="text-sm text-text2 py-6">Сделок пока нет.</div> : null}

            <Pagination
              page={dealsQ.data?.page ?? page}
              totalPages={dealsQ.data?.totalPages ?? 1}
              onPage={(next) => {
                const n = String(Math.max(1, next));
                const sp2 = new URLSearchParams(sp);
                sp2.set("page", n);
                setSp(sp2, { replace: true });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
