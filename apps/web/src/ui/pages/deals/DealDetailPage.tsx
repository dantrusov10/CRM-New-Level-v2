import React from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { Tabs } from "../../components/Tabs";
import { pb } from "../../../lib/pb";
import { useAiInsights, useDeal, useFunnelStages, useTimeline, useUpdateDeal } from "../../data/hooks";
import { DealKpModule } from "../../modules/kp/DealKpModule";
import { DynamicEntityFormWithRef, DynamicEntityFormHandle } from "../../components/DynamicEntityForm";

type AnyObj = Record<string, any>;

function formatMoney(v?: number | null) {
  if (typeof v !== "number") return "";
  try {
    return new Intl.NumberFormat("ru-RU").format(v);
  } catch {
    return String(v);
  }
}

function scoreBadge(score?: number | null) {
  if (typeof score !== "number") return { label: "—", tone: "muted" as const };
  if (score >= 70) return { label: `Риск: низкий`, tone: "success" as const };
  if (score >= 40) return { label: `Риск: средний`, tone: "warning" as const };
  return { label: `Риск: высокий`, tone: "danger" as const };
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 gap-3 items-center">
      <div className="col-span-4 text-xs text-text2">{label}</div>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      className="h-10 w-full rounded-card border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

function TimelineItemRow({ item }: { item: any }) {
  const ts = item.timestamp || item.created;
  const when = ts ? dayjs(ts).format("DD.MM.YYYY HH:mm") : "";
  const by = item.expand?.user_id?.name || item.expand?.user_id?.email || "";

  const action = String(item.action || "");
  const isComment = action === "comment";
  const isStage = action === "stage_change";
  const isAI = action.startsWith("ai");

  const dot = isComment ? "bg-primary" : isStage ? "bg-[#9CA3AF]" : isAI ? "bg-infoBorder" : "bg-borderHover";
  const title = isComment ? "Комментарий" : isStage ? "Этап" : isAI ? "AI" : "Событие";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-2 w-2 rounded-full ${dot}`} />
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-text2">{when}{by ? ` · ${by}` : ""}</div>
          <div className="text-xs text-text2">{title}</div>
        </div>
        <div className="text-sm mt-1 whitespace-pre-wrap">{item.comment || item.action}</div>
      </div>
    </div>
  );
}

export function DealDetailPage() {
  const { id } = useParams();
  const dealQ = useDeal(id!);
  const stagesQ = useFunnelStages();
  const tlQ = useTimeline("deal", id!);
  const aiQ = useAiInsights(id!);
  const upd = useUpdateDeal();

  const deal = dealQ.data as any;
  const stages = stagesQ.data ?? [];

  const [tab, setTab] = React.useState<string>("overview");
  const [comment, setComment] = React.useState<string>("");
  const [timelineFilter, setTimelineFilter] = React.useState<string>("all");
  const formRef = React.useRef<DynamicEntityFormHandle | null>(null);

  // form state
  const [title, setTitle] = React.useState<string>("");
  const [budget, setBudget] = React.useState<string>("");
  const [turnover, setTurnover] = React.useState<string>("");
  const [margin, setMargin] = React.useState<string>("");
  const [discount, setDiscount] = React.useState<string>("");
  const [salesChannel, setSalesChannel] = React.useState<string>("");
  const [partner, setPartner] = React.useState<string>("");
  const [distributor, setDistributor] = React.useState<string>("");
  const [purchaseFormat, setPurchaseFormat] = React.useState<string>("");
  const [activityType, setActivityType] = React.useState<string>("");
  const [endpoints, setEndpoints] = React.useState<string>("");
  const [infrastructureSize, setInfrastructureSize] = React.useState<string>("");
  const [presale, setPresale] = React.useState<string>("");
  const [registrationDeadline, setRegistrationDeadline] = React.useState<string>("");
  const [testStart, setTestStart] = React.useState<string>("");
  const [testEnd, setTestEnd] = React.useState<string>("");
  const [deliveryDate, setDeliveryDate] = React.useState<string>("");
  const [expectedPaymentDate, setExpectedPaymentDate] = React.useState<string>("");
  const [paymentReceivedDate, setPaymentReceivedDate] = React.useState<string>("");
  const [projectMapLink, setProjectMapLink] = React.useState<string>("");
  const [kaitenLink, setKaitenLink] = React.useState<string>("");

  const initialRef = React.useRef<AnyObj | null>(null);

  React.useEffect(() => {
    if (!deal?.id) return;
    // PocketBase schema: title + company_id + stage_id ...
    setTitle(deal.title ?? "");
    setBudget(typeof deal.budget === "number" ? String(deal.budget) : "");
    setTurnover(typeof deal.turnover === "number" ? String(deal.turnover) : "");
    setMargin(typeof deal.margin_percent === "number" ? String(deal.margin_percent) : "");
    setDiscount(typeof deal.discount_percent === "number" ? String(deal.discount_percent) : "");
    setSalesChannel(deal.sales_channel ?? "");
    setPartner(deal.partner ?? "");
    setDistributor(deal.distributor ?? "");
    setPurchaseFormat(deal.purchase_format ?? "");
    setActivityType(deal.activity_type ?? "");
    setEndpoints(typeof deal.endpoints === "number" ? String(deal.endpoints) : "");
    setInfrastructureSize(deal.infrastructure_size ?? "");
    setPresale(deal.presale ?? "");
    setRegistrationDeadline(deal.registration_deadline ?? "");
    setTestStart(deal.test_start ?? "");
    setTestEnd(deal.test_end ?? "");
    setDeliveryDate(deal.delivery_date ?? "");
    setExpectedPaymentDate(deal.expected_payment_date ?? "");
    setPaymentReceivedDate(deal.payment_received_date ?? "");
    setProjectMapLink(deal.project_map_link ?? "");
    setKaitenLink(deal.kaiten_link ?? "");

    initialRef.current = {
      title: deal.title ?? "",
      budget: deal.budget ?? null,
      turnover: deal.turnover ?? null,
      margin_percent: deal.margin_percent ?? null,
      discount_percent: deal.discount_percent ?? null,
      sales_channel: deal.sales_channel ?? "",
      partner: deal.partner ?? "",
      distributor: deal.distributor ?? "",
      purchase_format: deal.purchase_format ?? "",
      activity_type: deal.activity_type ?? "",
      endpoints: deal.endpoints ?? null,
      infrastructure_size: deal.infrastructure_size ?? "",
      presale: deal.presale ?? "",
      registration_deadline: deal.registration_deadline ?? "",
      test_start: deal.test_start ?? "",
      test_end: deal.test_end ?? "",
      delivery_date: deal.delivery_date ?? "",
      expected_payment_date: deal.expected_payment_date ?? "",
      payment_received_date: deal.payment_received_date ?? "",
      project_map_link: deal.project_map_link ?? "",
      kaiten_link: deal.kaiten_link ?? "",
    };
  }, [deal?.id]);

  async function createTimelineEvent(action: string, commentText?: string, payload?: any) {
    if (!id) return;
    const userId = (pb.authStore.model as any)?.id;
    await pb
      .collection("timeline")
      .create({
        deal_id: id,
        user_id: userId || null,
        action,
        comment: commentText || "",
        payload: payload ?? null,
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});
  }

  async function save() {
    if (!id) return;
    // New: dynamic, PB-driven form. The whole card is configured in settings_fields/settings_field_sections.
    await formRef.current?.save();
    await dealQ.refetch();
    tlQ.refetch();
  }

  async function changeStage(stageId: string) {
    if (!id) return;
    const prevName = deal?.expand?.stage_id?.stage_name ?? "";
    const nextName = stages.find((s: any) => s.id === stageId)?.stage_name ?? "";
    await pb.collection("deals").update(id, { stage_id: stageId }).catch(() => {});
    await createTimelineEvent("stage_change", `Этап изменён: ${prevName} → ${nextName}`, { from: prevName, to: nextName });
    await dealQ.refetch();
    tlQ.refetch();
  }

  async function addComment() {
    const text = comment.trim();
    if (!text || !id) return;
    await createTimelineEvent("comment", text);
    setComment("");
    tlQ.refetch();
  }

  const latestAi = (aiQ.data ?? [])[0] as any;
  const score = typeof latestAi?.score === "number" ? latestAi.score : typeof latestAi?.score_percent === "number" ? latestAi.score_percent : null;
  const sb = scoreBadge(score);

  const tlAll = (tlQ.data ?? []) as any[];
  const tlFiltered = tlAll.filter((t) => {
    if (timelineFilter === "comments") return String(t.action) === "comment";
    if (timelineFilter === "ai") return String(t.action).startsWith("ai") || String(t.action) === "ai";
    if (timelineFilter === "system") return String(t.action) !== "comment";
    return true;
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold">Сделка</div>
                <Badge>{deal?.expand?.stage_id?.stage_name || "Без этапа"}</Badge>
                <Badge>{deal?.expand?.company_id?.name ? "Компания: " + deal.expand.company_id.name : "Компания: —"}</Badge>
              </div>
              <div className="mt-3">
                <div className="text-lg font-semibold truncate">{deal?.title || "—"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={deal?.stage_id || ""} onChange={changeStage}>
                <option value="">Этап</option>
                {stages.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.stage_name}
                  </option>
                ))}
              </Select>
              <Button onClick={save} disabled={upd.isPending}>
                Сохранить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge>
                Бюджет: {budget ? `${formatMoney(Number(budget))} ₽` : "—"}
              </Badge>
              <Badge>
                Оборот: {turnover ? `${formatMoney(Number(turnover))} ₽` : "—"}
              </Badge>
              <Badge>Маржа: {margin ? `${margin}%` : "—"}</Badge>
              <Badge>Скидка: {discount ? `${discount}%` : "—"}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{sb.label}</Badge>
              <Badge>Score: {typeof score === "number" ? `${score}/100` : "—"}</Badge>
            </div>
          </div>

          <div className="mt-4">
            <Tabs
              items={[
                { key: "overview", label: "Обзор" },
                { key: "timeline", label: "Timeline" },
                { key: "relationship", label: "Relationship" },
                { key: "notes", label: "Заметки" },
                { key: "kp", label: "КП" },
                { key: "workspace", label: "Workspace" },
              ]}
              activeKey={tab}
              onChange={setTab}
            />
          </div>
        </CardContent>
      </Card>

      {/* MAIN AREA */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid gap-4">
          {tab === "overview" ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Карточка сделки</div>
                <div className="text-xs text-text2 mt-1">Полностью настраивается в Админ → Поля (разделы + поля).</div>
              </CardHeader>
              <CardContent>
                <DynamicEntityFormWithRef
                  ref={formRef}
                  entity="deal"
                  record={deal}
                  onSaved={async () => {
                    await dealQ.refetch();
                    tlQ.refetch();
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          {tab === "timeline" ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Timeline</div>
                    <div className="text-xs text-text2 mt-1">События: комментарии / этапы / изменения / AI</div>
                  </div>
                  <div className="w-56">
                    <Select value={timelineFilter} onChange={setTimelineFilter}>
                      <option value="all">Все</option>
                      <option value="comments">Комментарии</option>
                      <option value="system">Системные</option>
                      <option value="ai">AI</option>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tlQ.isLoading ? (
                  <div className="text-sm text-text2">Загрузка...</div>
                ) : (
                  <div className="grid gap-3">
                    {tlFiltered.map((t: any) => (
                      <TimelineItemRow key={t.id} item={t} />
                    ))}
                    {!tlFiltered.length ? <div className="text-sm text-text2">Событий пока нет.</div> : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === "relationship" ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Relationship Map</div>
                <div className="text-xs text-text2 mt-1">ЛПР/влияющие/блокеры + что важно + “что говорить”</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-text2">
                  Каркас. Дальше подключим контакты из <code>contacts_found</code> и карту ролей (ЛПР/ЛВР).
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "notes" ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Заметки</div>
                <div className="text-xs text-text2 mt-1">Быстрые заметки менеджера (пишем в timeline как note)</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-text2">
                  MVP: добавляй заметки через блок комментариев справа (тип — “Комментарий”).
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "kp" ? (
            <DealKpModule deal={deal} onTimeline={createTimelineEvent} />
          ) : null}

          {tab === "workspace" ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Workspace</div>
                <div className="text-xs text-text2 mt-1">Документы, ссылки, материалы по сделке</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-text2">
                  Каркас. Дальше подключим <code>entity_files</code> и <code>product_materials</code>.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <div className="col-span-4 grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Комментарии</div>
                <Badge>Все</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex gap-2">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Напишите комментарий…" />
                  <Button onClick={addComment} disabled={!comment.trim()}>Добавить</Button>
                </div>

                <div className="grid gap-3">
                  {tlAll
                    .filter((t) => String(t.action) === "comment")
                    .slice(0, 20)
                    .map((t) => (
                      <div key={t.id} className="rounded-card border border-border bg-white p-3">
                        <div className="text-xs text-text2">
                          {dayjs(t.timestamp || t.created).format("DD.MM.YYYY HH:mm")}
                          {t.expand?.user_id?.name ? ` · ${t.expand.user_id.name}` : ""}
                        </div>
                        <div className="text-sm mt-2 whitespace-pre-wrap">{t.comment}</div>
                      </div>
                    ))}
                  {!tlAll.some((t) => String(t.action) === "comment") ? (
                    <div className="text-sm text-text2">Комментариев пока нет.</div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-infoBorder bg-infoBg">
            <CardHeader className="border-infoBorder">
              <div className="text-sm font-semibold">Сигналы и риски</div>
              <div className="text-xs text-text2 mt-1">Score + резюме + рекомендации + риски</div>
            </CardHeader>
            <CardContent>
              {aiQ.isLoading ? (
                <div className="text-sm text-text2">Загрузка...</div>
              ) : latestAi ? (
                <div className="grid gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{sb.label}</Badge>
                    <Badge>Compliance: Balanced</Badge>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-text2">Score</div>
                    <div className="text-[26px] font-semibold">{typeof score === "number" ? `${score}/100` : "—"}</div>
                    <div className="text-xs text-text2 mt-1">Версия: {latestAi.created ? dayjs(latestAi.created).format("DD.MM.YYYY") : "—"}</div>
                  </div>
                  {latestAi.summary ? (
                    <div className="rounded-card border border-infoBorder bg-white p-3">
                      <div className="text-xs text-text2">Резюме</div>
                      <div className="text-sm mt-2 whitespace-pre-wrap">{latestAi.summary}</div>
                    </div>
                  ) : null}
                  {latestAi.suggestions || latestAi.recommendations ? (
                    <div className="rounded-card border border-infoBorder bg-white p-3">
                      <div className="text-xs text-text2">Рекомендации</div>
                      <div className="text-sm mt-2 whitespace-pre-wrap">{latestAi.suggestions || latestAi.recommendations}</div>
                    </div>
                  ) : null}
                  {latestAi.risks ? (
                    <div className="rounded-card border border-infoBorder bg-white p-3">
                      <div className="text-xs text-text2">Риски</div>
                      <div className="text-sm mt-2 whitespace-pre-wrap">
                        {typeof latestAi.risks === "string" ? latestAi.risks : JSON.stringify(latestAi.risks, null, 2)}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-text2">
                  AI ещё не запускался. Интеграция агента делается через создание записей <code>ai_insights</code> и событий в <code>timeline</code>.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
