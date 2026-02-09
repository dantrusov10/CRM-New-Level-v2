import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useCompaniesList, useUsers } from "../../data/hooks";
import { Input } from "../../components/Input";
import { Pagination } from "../../components/Pagination";
import { Button } from "../../components/Button";
import { pb } from "../../../lib/pb";

export function CompaniesPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = React.useState("");
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const city = sp.get("city") ?? "";
  const responsible = sp.get("responsible") ?? "";
  const filter = [
    city ? `city~"${city.replace(/"/g, "\\\"")}"` : "",
    responsible ? `responsible_id="${responsible}"` : "",
  ].filter(Boolean).join(" && ");

  const companiesQ = useCompaniesList({ search: q || undefined, filter, page, perPage: 25 });
  const companies: any[] = (companiesQ.data as any)?.items ?? [];
  const usersQ = useUsers();

  const selectedCount = selected.size;
  const allPageSelected = companies.length > 0 && companies.every((c) => selected.has(String(c.id)));

  React.useEffect(() => {
    setSelected(new Set());
  }, [page, q, filter]);

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
      if (want) companies.forEach((c) => n.add(String(c.id)));
      else companies.forEach((c) => n.delete(String(c.id)));
      return n;
    });
  }

  async function selectAllMatching() {
    const qf = q ? `name~"${q.replace(/\"/g, "\\\"")}"` : "";
    const fAll = [filter, qf].filter(Boolean).join(" && ");
    const options: any = { fields: "id", batch: 500 };
    if (fAll && String(fAll).trim().length) options.filter = fAll;
    const res = await pb.collection("companies").getFullList(options);
    const ids = (res as any[]).map((r) => String(r.id));
    setSelected(new Set(ids));
  }

  const [ownerTo, setOwnerTo] = React.useState("");

  async function bulkDelete() {
    if (!selectedCount) return;
    if (!confirm(`Удалить компании: ${selectedCount} шт.?`)) return;
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("companies").delete(id)));
    setSelected(new Set());
    await companiesQ.refetch();
  }

  async function bulkOwner() {
    if (!selectedCount) return;
    if (!ownerTo) return alert("Выбери ответственного");
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => pb.collection("companies").update(id, { responsible_id: ownerTo })));
    setSelected(new Set());
    setOwnerTo("");
    await companiesQ.refetch();
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Компании</div>
            <div className="text-xs text-text2 mt-1">Список компаний (по ТЗ)</div>
          </div>
          <div className="w-[360px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {companiesQ.isLoading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : companiesQ.error ? (
          <div className="text-sm text-danger">Ошибка загрузки</div>
        ) : (
          <div className="overflow-auto">
            {/* Bulk actions bar (always visible so it’s obvious) */}
            <div className="mb-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 rounded-card border border-border bg-white p-3">
              <div className="text-sm">
                Выбрано: <span className="font-semibold">{selectedCount}</span>
                {selectedCount > 0 && selectedCount === companies.length ? <span className="text-text2"> (страница)</span> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => togglePage(true)} disabled={!companies.length}>Выбрать страницу</Button>
                <Button variant="secondary" onClick={selectAllMatching} disabled={companiesQ.isLoading}>Выбрать все по фильтру</Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="danger" onClick={bulkDelete} disabled={!selectedCount}>Удалить</Button>
                <div className="flex items-center gap-2">
                  <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={ownerTo} onChange={(e) => setOwnerTo(e.target.value)}>
                    <option value="">Сменить ответственного…</option>
                    {(usersQ.data ?? []).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={bulkOwner} disabled={!selectedCount}>Применить</Button>
                </div>
              </div>
            </div>

            <table className="min-w-[900px] w-full text-sm">
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
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Город</th>
                  <th className="text-left px-3">Сайт</th>
                  <th className="text-left px-3">ИНН</th>
                </tr>
              </thead>
              <tbody>
                {(companies ?? []).map((c: any) => (
                  <tr key={c.id} className="h-11 border-b border-border hover:bg-rowHover cursor-pointer" onClick={() => nav(`/companies/${c.id}`)}>
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(String(c.id))} onChange={(e) => toggleOne(String(c.id), e.target.checked)} aria-label="Выбрать компанию" />
                    </td>
                    <td className="px-3 font-medium">{c.name}</td>
                    <td className="px-3 text-text2">{c.city ?? "—"}</td>
                    <td className="px-3 text-text2">{c.website ?? "—"}</td>
                    <td className="px-3 text-text2">{c.inn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(companies ?? []).length ? <div className="text-sm text-text2 py-6">Компаний пока нет.</div> : null}

            <Pagination
              page={(companiesQ.data as any)?.page ?? page}
              totalPages={(companiesQ.data as any)?.totalPages ?? 1}
              onPage={(next) => {
                const sp2 = new URLSearchParams(sp);
                sp2.set("page", String(Math.max(1, next)));
                setSp(sp2, { replace: true });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
