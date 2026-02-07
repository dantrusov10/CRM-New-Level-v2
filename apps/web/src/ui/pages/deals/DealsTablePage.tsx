import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useFunnelStages } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import dayjs from "dayjs";
import { pb } from "../../../lib/pb";

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const search = sp.get("search") ?? undefined;

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(50);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState(0);

  const [dynFields, setDynFields] = React.useState<Array<{ field_name: string; label: string; sort_order?: number }>>(
    []
  );

  const stage = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";

  const filter = [
    // PocketBase schema
    stage ? `stage_id="${stage}"` : "",
    owner ? `responsible_id="${owner}"` : "",
    channel ? `sales_channel="${channel.replace(/\"/g, "\\\"")}"` : "",
  ].filter(Boolean).join(" && ");

  // reset page on filter/search changes
  React.useEffect(() => {
    setPage(1);
  }, [search, stage, owner, channel]);

  // load dynamic fields from settings_fields (visible=true)
  React.useEffect(() => {
    (async () => {
      const res = await pb
        .collection("settings_fields")
        .getFullList({ sort: "sort_order", filter: `collection="deals" && visible=true` })
        .catch(() => [] as any);
      setDynFields((res as any[]).map((r) => ({ field_name: r.field_name, label: r.label, sort_order: r.sort_order })));
    })();
  }, []);

  async function load() {
    setLoading(true);
    const qFilter = search ? `title~"${String(search).replace(/"/g, "\\\"")}"` : "";
    const f = [filter, qFilter].filter(Boolean).join(" && ");
    const options: any = { sort: "-updated", expand: "company_id,stage_id,responsible_id" };
    if (f) options.filter = f;
    const res = await pb.collection("deals").getList(page, perPage, options);
    setItems(res.items as any);
    setTotalPages(res.totalPages ?? 1);
    setTotalItems(res.totalItems ?? (res.items?.length ?? 0));
    setLoading(false);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, filter]);

  useFunnelStages();

  const baseColumns = React.useMemo(
    () => [
      { key: "title", label: "Сделка" },
      { key: "company", label: "Компания" },
      { key: "owner", label: "Ответственный" },
      { key: "stage", label: "Этап" },
      { key: "budget", label: "Бюджет", align: "right" as const },
      { key: "turnover", label: "Оборот", align: "right" as const },
      { key: "margin_percent", label: "Маржа %", align: "right" as const },
      { key: "sales_channel", label: "Канал" },
      { key: "updated", label: "Обновлено" },
    ],
    []
  );

  const extraColumns = React.useMemo(() => {
    const reserved = new Set(["title", "company_id", "responsible_id", "stage_id", "budget", "turnover", "margin_percent", "sales_channel", "updated"]);
    return dynFields.filter((f) => f.field_name && !reserved.has(f.field_name));
  }, [dynFields]);

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
        {loading ? (
          <div className="text-sm text-text2">Загрузка...</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  {baseColumns.map((c) => (
                    <th
                      key={c.key}
                      className={`${c.align === "right" ? "text-right" : "text-left"} px-3 whitespace-nowrap`}
                    >
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
                {items?.map((d: any) => (
                  <tr
                    key={d.id}
                    className="h-11 border-b border-border hover:bg-rowHover cursor-pointer"
                    onClick={() => nav(`/deals/${d.id}`)}
                  >
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

                    {extraColumns.map((col) => {
                      const v = d[col.field_name];
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

            {!items?.length ? <div className="text-sm text-text2 py-6">Сделок пока нет.</div> : null}

            {/* pagination */}
            <div className="flex items-center justify-between mt-4 gap-3">
              <div className="text-xs text-text2">
                Всего: {totalItems} · Страница {page} из {totalPages}
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
