import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useDeals, useFunnelStages } from "../../data/hooks";
import { Badge } from "../../components/Badge";
import dayjs from "dayjs";

export function DealsTablePage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const search = sp.get("search") ?? undefined;

  const stage = sp.get("stage") ?? "";
  const owner = sp.get("owner") ?? "";
  const channel = sp.get("channel") ?? "";

  const filter = [
    stage ? `stage="${stage}"` : "",
    owner ? `owner="${owner}"` : "",
    channel ? `channel~"${channel.replace(/\"/g, "\\\"")}"` : "",
  ].filter(Boolean).join(" && ");

  const dealsQ = useDeals({ search, filter });
  useFunnelStages();

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
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
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
                {dealsQ.data?.map((d: any) => (
                  <tr
                    key={d.id}
                    className="h-11 border-b border-border hover:bg-rowHover cursor-pointer"
                    onClick={() => nav(`/deals/${d.id}`)}
                  >
                    <td className="px-3 font-medium">{d.name}</td>
                    <td className="px-3 text-text2">{d.expand?.company?.name ?? "—"}</td>
                    <td className="px-3 text-text2">{d.expand?.owner?.name ?? d.expand?.owner?.email ?? "—"}</td>
                    <td className="px-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.expand?.stage?.color ?? "#9CA3AF" }} />
                        <span className="text-text2">{d.expand?.stage?.name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-3 text-right tabular-nums">{d.budget ? d.budget.toLocaleString("ru-RU") : "—"}</td>
                    <td className="px-3 text-right tabular-nums">{d.turnover ? d.turnover.toLocaleString("ru-RU") : "—"}</td>
                    <td className="px-3 text-right tabular-nums">{typeof d.margin_percent === "number" ? `${d.margin_percent}%` : "—"}</td>
                    <td className="px-3 text-text2">{d.channel ?? "—"}</td>
                    <td className="px-3 text-text2">{d.updated ? dayjs(d.updated).format("DD.MM.YYYY HH:mm") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dealsQ.data?.length ? <div className="text-sm text-text2 py-6">Сделок пока нет.</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
