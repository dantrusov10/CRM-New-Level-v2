import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useCompaniesList } from "../../data/hooks";
import { Input } from "../../components/Input";
import { Pagination } from "../../components/Pagination";

export function CompaniesPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = React.useState("");
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const city = sp.get("city") ?? "";
  const responsible = sp.get("responsible") ?? "";
  const filter = [
    city ? `city~"${city.replace(/"/g, "\\\"")}"` : "",
    responsible ? `responsible_id="${responsible}"` : "",
  ].filter(Boolean).join(" && ");

  const companiesQ = useCompaniesList({ search: q || undefined, filter, page, perPage: 25 });
  const companies: any[] = (companiesQ.data as any)?.items ?? [];


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
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Город</th>
                  <th className="text-left px-3">Сайт</th>
                  <th className="text-left px-3">ИНН</th>
                </tr>
              </thead>
              <tbody>
                {(companies ?? []).map((c: any) => (
                  <tr key={c.id} className="h-11 border-b border-border hover:bg-rowHover cursor-pointer" onClick={() => nav(`/companies/${c.id}`)}>
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
