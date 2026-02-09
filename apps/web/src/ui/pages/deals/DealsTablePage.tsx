import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useDealsList, useFunnelStages, useUsers } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import { Pagination } from "../../components/Pagination";
import { Button } from "../../components/Button";
import dayjs from "dayjs";
import { pb } from "../../../lib/pb";

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const search = sp.get("search") ?? undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const stage = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";

  const filter = [
    // PocketBase schema
    stage ? `stage_id="${stage}"` : "",
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/\"/g, "\\\"")}"` : "",
  ].filter(Boolean).join(" && ");

  const dealsQ = useDealsList({ search, filter, page, perPage: 25 });
  const stagesQ = useFunnelStages();
  const usersQ = useUsers();

  const items: any[] = (dealsQ.data as any)?.items ?? [];

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const selectedCount = selected.size;
  const allPageSelected = items.length > 0 && items.every((d) => selected.has(String(d.id)));

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
      if (want) items.forEach((d) => n.add(String(d.id)));
      else items.forEach((d) => n.delete(String(d.id)));
      return n;
    });
  }

  async function selectAllMatching() {
    // selects all deals matching current filters + search
    const q = search ? `title~"${search.replace(/\"/g, "\\\"")}"` : "";
    const fAll = [filter, q].filter(Boolean).join(" && ");
    const options: any = { fields: "id", batch: 500 };
    if (fAll && String(fAll).trim().length) options.filter = fAll;
    const res = await pb.collection("deals").getFullList(options);
    const ids = (res as any[]).map((r) => String(r.id));
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
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Сделки</div>
            <div className="text-xs text-text2 mt-1">Табличный вид (колонки по ТЗ, упрощённая настраиваемость в MVP)</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {search ? <Badge>поиск: {search}</Badge> : null}
            {stage ? <Badge>этап</Badge> : null}
            {owner ? <Badge>ответственный</Badge> : null}
            {channel ? <Badge>канал: {channel}</Badge> : null}
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
            {selectedCount ? (
              <div className="mb-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 rounded-card border border-border bg-white p-3">
                <div className="text-sm">
                  Выбрано: <span className="font-semibold">{selectedCount}</span>
                  {selectedCount === items.length ? <span className="text-text2"> (страница)</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="danger" onClick={bulkDelete}>Удалить</Button>
                  <div className="flex items-center gap-2">
                    <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={stageTo} onChange={(e) => setStageTo(e.target.value)}>
                      <option value="">Сменить этап…</option>
                      {(stagesQ.data ?? []).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.stage_name ?? "Этап"}</option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={bulkStage}>Применить</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={ownerTo} onChange={(e) => setOwnerTo(e.target.value)}>
                      <option value="">Сменить ответственного…</option>
                      {(usersQ.data ?? []).map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={bulkOwner}>Применить</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs text-text2">Выбери сделки чекбоксами, чтобы выполнить массовое действие</div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => togglePage(true)} disabled={!items.length}>Выбрать страницу</Button>
                  <Button variant="secondary" onClick={selectAllMatching}>Выбрать все по фильтру</Button>
                </div>
              </div>
            )}

            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
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
                {(items ?? []).map((d: any) => (
                  <tr
                    key={d.id}
                    className="h-11 border-b border-border hover:bg-rowHover cursor-pointer"
                    onClick={() => nav(`/deals/${d.id}`)}
                  >
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(String(d.id))} onChange={(e) => toggleOne(String(d.id), e.target.checked)} aria-label="Выбрать сделку" />
                    </td>
                    <td className="px-3 font-medium">{d.title}</td>
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
