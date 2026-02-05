import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useCompanies } from "../../data/hooks";
import { Input } from "../../components/Input";

export function CompaniesPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [q, setQ] = React.useState("");

  const city = sp.get("city") ?? "";
  const responsible = sp.get("responsible") ?? "";
  const filter = [
    city ? `city~"${city.replace(/"/g, "\\\"")}"` : "",
    responsible ? `responsible="${responsible}"` : "",
  ].filter(Boolean).join(" && ");

  const companiesQ = useCompanies({ search: q || undefined, filter });

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
                {(companiesQ.data ?? []).map((c: any) => (
                  <tr key={c.id} className="h-11 border-b border-border hover:bg-rowHover cursor-pointer" onClick={() => nav(`/companies/${c.id}`)}>
                    <td className="px-3 font-medium">{c.name}</td>
                    <td className="px-3 text-text2">{c.city ?? "—"}</td>
                    <td className="px-3 text-text2">{c.site ?? "—"}</td>
                    <td className="px-3 text-text2">{c.inn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!companiesQ.data?.length ? <div className="text-sm text-text2 py-6">Компаний пока нет.</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
