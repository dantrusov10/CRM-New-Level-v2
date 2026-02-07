import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { pb } from "../../../lib/pb";

export function CompaniesPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [q, setQ] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(50);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);

  const [dynFields, setDynFields] = React.useState<Array<{ field_name: string; label: string; sort_order?: number }>>(
    []
  );

  const city = sp.get("city") ?? "";
  const responsible = sp.get("responsible") ?? "";
  const filter = [
    city ? `city~"${city.replace(/"/g, "\\\"")}"` : "",
    responsible ? `responsible_id="${responsible}"` : "",
  ].filter(Boolean).join(" && ");

  // reset page on filter/search changes
  React.useEffect(() => {
    setPage(1);
  }, [q, city, responsible]);

  // load dynamic fields from settings_fields (visible=true)
  React.useEffect(() => {
    (async () => {
      const res = await pb
        .collection("settings_fields")
        .getFullList({
          sort: "sort_order",
          filter: `collection="companies" && visible=true`,
        })
        .catch(() => [] as any);
      setDynFields(
        (res as any[]).map((r) => ({ field_name: r.field_name, label: r.label, sort_order: r.sort_order }))
      );
    })();
  }, []);

  async function load() {
    setLoading(true);
    const qFilter = q ? `name~"${q.replace(/"/g, "\\\"")}"` : "";
    const f = [filter, qFilter].filter(Boolean).join(" && ");
    const options: any = { sort: "name" };
    if (f) options.filter = f;
    const res = await pb.collection("companies").getList(page, perPage, options);
    setItems(res.items as any);
    setTotalPages(res.totalPages ?? 1);
    setTotalItems(res.totalItems ?? (res.items?.length ?? 0));
    setLoading(false);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, q, filter]);

  const baseColumns = React.useMemo(
    () => [
      { key: "name", label: "Название" },
      { key: "city", label: "Город" },
      { key: "website", label: "Сайт" },
      { key: "inn", label: "ИНН" },
    ],
    []
  );

  const extraColumns = React.useMemo(() => {
    const baseKeys = new Set(baseColumns.map((c) => c.key));
    // keep only fields not already in base
    return dynFields.filter((f) => f.field_name && !baseKeys.has(f.field_name));
  }, [dynFields, baseColumns]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Компании</div>
            <div className="text-xs text-text2 mt-1">
              Список компаний · всего: {totalItems}
            </div>
          </div>
          <div className="w-[360px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  {baseColumns.map((c) => (
                    <th key={c.key} className="text-left px-3 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  {extraColumns.map((c) => (
                    <th key={c.field_name} className="text-left px-3 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((c: any) => (
                  <tr key={c.id} className="h-11 border-b border-border hover:bg-rowHover cursor-pointer" onClick={() => nav(`/companies/${c.id}`)}>
                    {baseColumns.map((col) => (
                      <td key={col.key} className={col.key === "name" ? "px-3 font-medium" : "px-3 text-text2"}>
                        {c[col.key] ?? "—"}
                      </td>
                    ))}
                    {extraColumns.map((col) => {
                      const v = c[col.field_name];
                      const text = v === undefined || v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
                      return (
                        <td key={col.field_name} className="px-3 text-text2 max-w-[260px] truncate" title={text}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {!items?.length ? <div className="text-sm text-text2 py-6">Компаний пока нет.</div> : null}

            {/* pagination */}
            <div className="flex items-center justify-between mt-4 gap-3">
              <div className="text-xs text-text2">
                Страница {page} из {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-card border border-border bg-white px-2 text-sm"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  {[25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n} / стр
                    </option>
                  ))}
                </select>
                <Button variant="secondary" small onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Назад
                </Button>
                <Button variant="secondary" small onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Вперёд
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
