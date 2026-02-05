import React from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { useAiInsights, useDeal, useFunnelStages, useTimeline, useUpdateDeal } from "../../data/hooks";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { pb } from "../../../lib/pb";
import dayjs from "dayjs";

export function DealDetailPage() {
  const { id } = useParams();
  const dealQ = useDeal(id!);
  const stagesQ = useFunnelStages();
  const tlQ = useTimeline("deal", id!);
  const aiQ = useAiInsights(id!);
  const upd = useUpdateDeal();

  const deal = dealQ.data as any;
  const stages = stagesQ.data ?? [];

  const [name, setName] = React.useState("");
  const [budget, setBudget] = React.useState<string>("");
  const [turnover, setTurnover] = React.useState<string>("");
  const [margin, setMargin] = React.useState<string>("");

  React.useEffect(() => {
    if (deal) {
      setName(deal.name ?? "");
      setBudget(deal.budget ? String(deal.budget) : "");
      setTurnover(deal.turnover ? String(deal.turnover) : "");
      setMargin(typeof deal.margin_percent === "number" ? String(deal.margin_percent) : "");
    }
  }, [deal?.id]);

  async function save() {
    if (!id) return;
    const data: any = {
      name,
      budget: budget ? Number(budget) : null,
      turnover: turnover ? Number(turnover) : null,
      margin_percent: margin ? Number(margin) : null,
    };
    await upd.mutateAsync({ id, data });
    await pb.collection("timeline").create({
      entity_type: "deal",
      entity_id: id,
      action: "update",
      message: "Изменены поля сделки",
    }).catch(() => {});
    tlQ.refetch();
  }

  async function changeStage(stageId: string) {
    if (!id) return;
    const prevName = deal?.expand?.stage?.name ?? "";
    const nextName = stages.find((s) => s.id === stageId)?.name ?? "";
    await pb.collection("deals").update(id, { stage: stageId });
    await pb.collection("timeline").create({
      entity_type: "deal",
      entity_id: id,
      action: "stage_change",
      message: `Смена этапа: ${prevName} → ${nextName}`,
    }).catch(() => {});
    await dealQ.refetch();
    tlQ.refetch();
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Карточка сделки</div>
              <div className="text-xs text-text2 mt-1">Заголовок + финансы + параметры (по ТЗ)</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                value={deal?.stage ?? ""}
                onChange={(e) => changeStage(e.target.value)}
              >
                <option value="" disabled>Этап</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button onClick={save} disabled={upd.isPending}>Сохранить</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dealQ.isLoading ? (
            <div className="text-sm text-text2">Загрузка...</div>
          ) : dealQ.error ? (
            <div className="text-sm text-danger">Ошибка</div>
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-text2 mb-1">Название</div>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-text2 mb-1">Компания</div>
                  <div className="h-10 rounded-card border border-border bg-rowHover px-3 flex items-center text-sm">
                    {deal?.expand?.company?.name ?? "—"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-text2 mb-1">Бюджет</div>
                  <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="1000000" />
                </div>
                <div>
                  <div className="text-xs text-text2 mb-1">Оборот</div>
                  <Input value={turnover} onChange={(e) => setTurnover(e.target.value)} placeholder="800000" />
                </div>
                <div>
                  <div className="text-xs text-text2 mb-1">Маржа %</div>
                  <Input value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="25" />
                </div>
              </div>

              <div className="text-xs text-text2">
                Расширенные коммерческие/проектные параметры (канал продаж, партнёр, закупка, сроки, ссылки) — коллекции есть в PocketBase,
                UI для них можно включать итеративно.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Timeline</div>
            <div className="text-xs text-text2 mt-1">Единая лента событий (создание/этапы/изменения/AI)</div>
          </CardHeader>
          <CardContent>
            {tlQ.isLoading ? (
              <div className="text-sm text-text2">Загрузка...</div>
            ) : (
              <div className="grid gap-3">
                {(tlQ.data ?? []).map((t: any) => (
                  <div key={t.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-[#9CA3AF]" />
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-text2">{dayjs(t.created).format("DD.MM.YYYY HH:mm")}</div>
                      <div className="text-sm">{t.message ?? t.action}</div>
                    </div>
                  </div>
                ))}
                {!tlQ.data?.length ? <div className="text-sm text-text2">Событий пока нет.</div> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#B6CCFF] bg-infoBg">
          <CardHeader className="border-[#B6CCFF]">
            <div className="text-sm font-semibold">AI Insights</div>
            <div className="text-xs text-text2 mt-1">Score + резюме + рекомендации + риски (каркас)</div>
          </CardHeader>
          <CardContent>
            {aiQ.isLoading ? (
              <div className="text-sm text-text2">Загрузка...</div>
            ) : (
              <div className="grid gap-3">
                {(aiQ.data ?? []).slice(0, 3).map((a: any) => (
                  <div key={a.id} className="rounded-card border border-infoBorder bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[26px] font-semibold">{typeof a.score_percent === "number" ? `${a.score_percent}%` : "—"}</div>
                      <div className="text-xs text-text2">{a.created ? dayjs(a.created).format("DD.MM.YYYY") : ""}</div>
                    </div>
                    <div className="text-sm mt-2">{a.summary ?? "—"}</div>
                    {a.recommendations ? <div className="text-xs text-text2 mt-2">Рекомендации: {a.recommendations}</div> : null}
                    {a.risks ? <div className="text-xs text-text2 mt-1">Риски: {a.risks}</div> : null}
                  </div>
                ))}
                {!aiQ.data?.length ? (
                  <div className="text-sm text-text2">
                    AI ещё не запускался. Интеграция агента делается через создание записей `ai_insights` и событий в `timeline`.
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
