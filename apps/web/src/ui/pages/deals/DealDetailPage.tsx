import React from "react";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { DateTimePicker } from "../../components/DateTimePicker";
import { Badge } from "../../components/Badge";
import { Tabs } from "../../components/Tabs";
import { Modal } from "../../components/Modal";
import { pb, getAuthUser } from "../../../lib/pb";
import {
  useAiInsights,
  useContactsFound,
  useCreateContactFound,
  useDeleteContactFound,
  useDeal,
  useEntityFiles,
  useAddWorkspaceFile,
  useDeleteEntityFileLink,
  useFunnelStages,
  useTimeline,
  useUpdateDeal,
  useCreateTask,
} from "../../data/hooks";
import { DealKpModule } from "../../modules/kp/DealKpModule";
import { DynamicEntityFormWithRef, DynamicEntityFormHandle } from "../../components/DynamicEntityForm";
import type { AiInsight, Deal, FunnelStage, TimelineItem } from "../../../lib/types";
import type { ContactFound, EntityFileLink } from "../../data/hooks";
import { analyzeDealWithAi } from "../../../lib/aiGateway";

type AnyObj = Record<string, unknown>;
type TimelinePayload = Record<string, unknown>;
type AiSection = { key: string; title: string; raw: unknown };

function extractScoreFromExplainability(ex: unknown): number | null {
  if (!ex || typeof ex !== "object" || Array.isArray(ex)) return null;
  const o = ex as Record<string, unknown>;
  const tryNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(100, Math.round(v)));
    if (typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v)) {
      const n = Math.round(Number(v.trim()));
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    }
    return null;
  };
  for (const k of ["probability", "Probability", "score", "Score", "deal_probability", "dealProbability", "current_score", "Current score"]) {
    const n = tryNum(o[k]);
    if (n != null && n > 0) return n;
  }
  return null;
}

function resolveDisplayScore(insight: AiInsight | null): number | null {
  if (!insight) return null;
  const direct = typeof insight.score === "number" ? insight.score : null;
  const alt = typeof insight.score_percent === "number" ? insight.score_percent : null;
  const fromEx = extractScoreFromExplainability(insight.explainability);
  if (direct != null && direct > 0) return direct;
  if (fromEx != null) return fromEx;
  if (alt != null && alt > 0) return alt;
  if (direct != null) return direct;
  return alt;
}

function tryParseHeadingPlusJson(block: string): { title: string; body: unknown } | null {
  const trimmed = block.trim();
  const sameLine = trimmed.match(/^([^:\n]{2,100}):\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
  if (sameLine) {
    const parsed = parseJsonLoose(sameLine[2]);
    if (parsed !== null && typeof parsed !== "string") return { title: sameLine[1].trim(), body: parsed };
  }
  const multiline = trimmed.match(/^([^:\n]{2,100}):\s*\n([\s\S]+)$/);
  if (multiline) {
    const parsed = parseJsonLoose(multiline[2].trim());
    if (parsed !== null && typeof parsed !== "string") return { title: multiline[1].trim(), body: parsed };
  }
  return null;
}

function AiStructuredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="text-sm leading-relaxed text-text">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string" || typeof x === "number")) {
      return (
        <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-text marker:text-primary/80">
          {value.map((x, i) => (
            <li key={i} className="pl-0.5">
              {String(x)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className={`grid gap-2 ${depth > 0 ? "mt-1" : ""}`}>
        {value.map((x, i) => (
          <div key={i} className="rounded-lg border border-border bg-rowHover/80 px-3 py-2">
            <AiStructuredValue value={x} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const entries = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "");
    if (!entries.length) return null;
    return (
      <dl className={`grid gap-2.5 ${depth > 0 ? "mt-1" : ""}`}>
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-md border-l-2 border-primary/50 bg-[rgba(255,255,255,0.04)] pl-3 pr-2 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text2">{toSectionTitle(k)}</dt>
            <dd className="mt-1">
              {typeof v === "object" ? <AiStructuredValue value={v} depth={depth + 1} /> : <span className="text-sm text-text">{String(v)}</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

function SmartStringContent({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const whole = parseJsonLoose(trimmed);
  if (whole !== null && typeof whole !== "string") {
    return <AiStructuredValue value={whole} />;
  }
  const blocks = trimmed.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed text-text">{text}</div>;
  }
  return (
    <div className="grid gap-4">
      {blocks.map((block, i) => {
        const headed = tryParseHeadingPlusJson(block);
        if (headed) {
          return (
            <div key={i} className="rounded-lg border border-border bg-rowHover/60 p-3">
              <div className="mb-2 border-b border-border/70 pb-1.5 text-xs font-semibold text-text">{headed.title}</div>
              <AiStructuredValue value={headed.body} />
            </div>
          );
        }
        const parsed = parseJsonLoose(block);
        if (parsed !== null && typeof parsed !== "string") {
          return (
            <div key={i} className="rounded-lg border border-border bg-rowHover/60 p-3">
              <AiStructuredValue value={parsed} />
            </div>
          );
        }
        return (
          <div key={i} className="text-sm whitespace-pre-wrap leading-relaxed text-text">
            {block}
          </div>
        );
      })}
    </div>
  );
}

function AiInsightSectionBody({ value }: { value: unknown }) {
  if (typeof value === "string") return <SmartStringContent text={value} />;
  return <AiStructuredValue value={value} />;
}

function AiRisksVisual({ raw }: { raw: unknown }) {
  const parsed: unknown =
    typeof raw === "string" ? parseJsonLoose(raw.trim()) || raw : raw;
  if (Array.isArray(parsed)) {
    return (
      <div className="grid gap-3">
        {parsed.map((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return (
              <div key={index} className="rounded-lg border border-border bg-rowHover/80 px-3 py-2 text-sm text-text">
                {String(item)}
              </div>
            );
          }
          const o = item as Record<string, unknown>;
          const name = String(o.name ?? o.title ?? `Риск ${index + 1}`);
          const desc = String(o.description ?? o.details ?? "").trim();
          const crit = o.criticality != null ? String(o.criticality) : "";
          const prob = o.probability != null ? String(o.probability) : "";
          return (
            <div
              key={index}
              className="rounded-lg border border-amber-500/35 bg-[rgba(251,191,36,0.07)] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-text">
                  {index + 1}. {name}
                </span>
                {crit ? (
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium uppercase text-text2">
                    {crit}
                  </span>
                ) : null}
                {prob ? (
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-text2">
                    {prob}%
                  </span>
                ) : null}
              </div>
              {desc ? <p className="mt-1.5 text-sm leading-relaxed text-text">{desc}</p> : null}
            </div>
          );
        })}
      </div>
    );
  }
  const text = formatRisksForDisplay(raw);
  return text ? <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div> : null;
}

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

function toSectionTitle(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

function toBusinessSectionTitle(key: string) {
  const k = String(key || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    comments: "Комментарии",
    comment: "Комментарии",
    notes: "Комментарии",
    executive_summary: "Краткий вывод",
    exec_summary: "Краткий вывод",
    short_summary: "Краткий вывод",
    next_steps: "Следующие шаги",
    next_actions: "Следующие шаги",
    action_plan: "Следующие шаги",
    plan_of_actions: "Следующие шаги",
    recommendations: "Рекомендации",
    suggestion: "Рекомендации",
    suggestions: "Рекомендации",
    risks: "Риски",
    risk_register: "Риски",
    data_gaps: "Чего не хватает",
    missing_data: "Чего не хватает",
    upsides: "Точки роста",
    upside: "Точки роста",
    growth_points: "Точки роста",
    commercial_assessment: "Коммерческая оценка",
    commercial_evaluation: "Коммерческая оценка",
    deal_closure_strategy: "Стратегия закрытия",
    close_strategy: "Стратегия закрытия",
    closing_strategy: "Стратегия закрытия",
    explainability: "Объяснение оценки",
    score_explainability: "Объяснение оценки",
    next_best_actions: "Следующие шаги",
    company_context: "Контекст клиента",
    contacts: "Контакты",
    pains_and_needs: "Боли и потребности",
    presell_depth: "Пресейл",
    competitors: "Конкуренция",
    timing: "Тайминг",
  };
  return aliases[k] || toSectionTitle(key);
}

function sectionPriority(key: string): number {
  const k = String(key || "").trim().toLowerCase();
  const order: Record<string, number> = {
    executive_summary: 10,
    exec_summary: 10,
    short_summary: 10,
    explainability: 20,
    score_explainability: 20,
    next_best_actions: 30,
    next_steps: 30,
    next_actions: 30,
    action_plan: 30,
    recommendations: 40,
    suggestions: 40,
    risks: 50,
    risk_register: 50,
    upside: 60,
    upsides: 60,
    growth_points: 60,
    data_gaps: 70,
    missing_data: 70,
    commercial_assessment: 80,
    commercial_evaluation: 80,
    deal_closure_strategy: 90,
    close_strategy: 90,
    closing_strategy: 90,
    comments: 100,
    notes: 100,
  };
  return order[k] ?? 500;
}

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Parse JSON or legacy Python-ish repr (single quotes) from older gateway rows. */
function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    /* empty */
  }
  try {
    return JSON.parse(t.replace(/'/g, '"'));
  } catch {
    return null;
  }
}

function formatRiskItem(item: unknown, index: number): string {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return `${index + 1}. ${valueToText(item)}`.trim();
  }
  const o = item as Record<string, unknown>;
  const name = String(o.name ?? o.title ?? `Риск ${index + 1}`);
  const desc = String(o.description ?? o.details ?? "").trim();
  const crit = o.criticality != null ? String(o.criticality) : "";
  const prob = o.probability != null ? String(o.probability) : "";
  const lines = [`${index + 1}. ${name}`];
  if (desc) lines.push(`   ${desc}`);
  if (crit) lines.push(`   Критичность: ${crit}`);
  if (prob) lines.push(`   Вероятность: ${prob}%`);
  return lines.join("\n");
}

function formatRisksForDisplay(raw: unknown): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) {
    return raw.map((x, i) => formatRiskItem(x, i)).join("\n\n");
  }
  if (typeof raw === "object") {
    return formatRiskItem(raw, 0);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return "";
    const parsed = parseJsonLoose(s);
    if (parsed != null && parsed !== s) {
      return formatRisksForDisplay(parsed);
    }
    return s;
  }
  return valueToText(raw);
}

function buildDynamicSections(insight: AiInsight | null): AiSection[] {
  if (!insight || !insight.explainability || typeof insight.explainability !== "object") return [];
  const source = insight.explainability as Record<string, unknown>;
  const sections: AiSection[] = [];
  const reserved = new Set([
    "score",
    "summary",
    "suggestions",
    "recommendations",
    "risks",
    "risk",
    "model",
    "usage",
    "token_usage",
    "_scoring",
    "scoring",
    "raw_model_output",
  ]);
  const seenTitles = new Set<string>();
  const seenSigs = new Set<string>();
  for (const [key, raw] of Object.entries(source)) {
    if (reserved.has(key.toLowerCase())) continue;
    if (raw === undefined || raw === null || raw === "") continue;
    const text = valueToText(raw);
    if (!text) continue;
    const title = toBusinessSectionTitle(key);
    const nt = title.toLowerCase();
    let sig: string;
    try {
      sig = JSON.stringify(raw);
    } catch {
      sig = text;
    }
    if (seenTitles.has(nt) || seenSigs.has(sig)) continue;
    seenTitles.add(nt);
    seenSigs.add(sig);
    sections.push({ key, title, raw });
  }
  sections.sort((a, b) => {
    const p = sectionPriority(a.key) - sectionPriority(b.key);
    if (p !== 0) return p;
    return a.title.localeCompare(b.title, "ru");
  });
  return sections;
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

function TimelineItemRow({ item }: { item: TimelineItem & { expand?: { user_id?: { name?: string; email?: string } } } }) {
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
  const contactsQ = useContactsFound(id!);
  const createContactM = useCreateContactFound();
  const deleteContactM = useDeleteContactFound();
  const entityFilesQ = useEntityFiles("deal", id!);
  const addWorkspaceFileM = useAddWorkspaceFile();
  const deleteEntityFileM = useDeleteEntityFileLink();
  const upd = useUpdateDeal();

  const deal = (dealQ.data ?? null) as Deal | null;
  const stages = stagesQ.data ?? [];

  const [tab, setTab] = React.useState<string>("overview");
  const [composerType, setComposerType] = React.useState<"comment" | "note" | "task">("comment");
  const [comment, setComment] = React.useState<string>("");
  const [taskDueAt, setTaskDueAt] = React.useState<string>("");
  const [timelineFilter, setTimelineFilter] = React.useState<string>("all");
  const [aiRunLoading, setAiRunLoading] = React.useState(false);
  const [aiRunError, setAiRunError] = React.useState<string>("");
  const formRef = React.useRef<DynamicEntityFormHandle | null>(null);

  const auth = getAuthUser();
  const createTaskM = useCreateTask();

  // Contacts modal
  const [contactModal, setContactModal] = React.useState(false);
  const [cFullName, setCFullName] = React.useState("");
  const [cPosition, setCPosition] = React.useState("");
  const [cPhone, setCPhone] = React.useState("");
  const [cEmail, setCEmail] = React.useState("");
  const [cTelegram, setCTelegram] = React.useState("");
  const [cInfluence, setCInfluence] = React.useState<string>("");
  const [cError, setCError] = React.useState<string>("");

  // Workspace add file/link
  const [wsUrl, setWsUrl] = React.useState("");
  const [wsTitle, setWsTitle] = React.useState("");
  const [wsTag, setWsTag] = React.useState("");
  const [wsLinkUrl, setWsLinkUrl] = React.useState("");
  const [wsLinkTitle, setWsLinkTitle] = React.useState("");

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

  async function createTimelineEvent(action: string, commentText?: string, payload?: TimelinePayload) {
    if (!id) return;
    const userId = pb.authStore.model?.id;
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
    const nextName = stages.find((s) => s.id === stageId)?.stage_name ?? "";
    await pb.collection("deals").update(id, { stage_id: stageId }).catch(() => {});
    await createTimelineEvent("stage_change", `Этап изменён: ${prevName} → ${nextName}`, { from: prevName, to: nextName });
    await dealQ.refetch();
    tlQ.refetch();
  }

  async function submitComposer() {
    const text = comment.trim();
    if (!id) return;

    if (composerType === "task") {
      const due = taskDueAt ? new Date(taskDueAt) : null;
      if (!text) return;
      if (!due || Number.isNaN(due.getTime())) return;
      if (!auth?.id) return;

      // create task record
      await createTaskM
        .mutateAsync({
          title: text,
          due_at: due.toISOString(),
          deal_id: id,
          company_id: deal?.company_id || deal?.expand?.company_id?.id,
          created_by: auth.id,
        })
        .catch(() => null);

      // add event to timeline (optional, for audit)
      await createTimelineEvent("task_created", `Задача: ${text}`, { due_at: due.toISOString() }).catch(() => null);
      setComment("");
      setTaskDueAt("");
      setComposerType("comment");
      tlQ.refetch();
      return;
    }

    if (!text) return;
    await createTimelineEvent(composerType === "note" ? "note" : "comment", text);
    setComment("");
    tlQ.refetch();
  }

  async function addContact() {
    if (!id) return;
    const full_name = cFullName.trim();
    const phone = cPhone.trim();
    const email = cEmail.trim();
    const telegram = cTelegram.trim();
    const position = cPosition.trim();
    if (!full_name) {
      setCError("Укажите имя контакта");
      return;
    }
    if (!phone && !email && !telegram) {
      setCError("Укажите хотя бы один контакт: телефон / email / Telegram");
      return;
    }
    setCError("");
    await createContactM
      .mutateAsync({
        deal_id: id,
        company_id: deal?.company_id || deal?.expand?.company_id?.id || null,
        full_name,
        position: position || "",
        phone: phone || "",
        email: email || "",
        telegram: telegram || "",
        influence_type: cInfluence || "",
        source_type: "manual",
        source_url: "",
        confidence: 1,
        is_verified: true,
      })
      .catch(() => null);
    setContactModal(false);
    setCFullName("");
    setCPosition("");
    setCPhone("");
    setCEmail("");
    setCTelegram("");
    setCInfluence("");
    contactsQ.refetch();
  }

  async function addWorkspaceFile() {
    if (!id) return;
    const url = wsUrl.trim();
    if (!url) return;
    await addWorkspaceFileM
      .mutateAsync({ entityType: "deal", entityId: id, url, title: wsTitle.trim(), tag: wsTag.trim() })
      .catch(() => null);
    setWsUrl("");
    setWsTitle("");
    setWsTag("");
    entityFilesQ.refetch();
  }

  async function addWorkspaceLink() {
    if (!id) return;
    const url = wsLinkUrl.trim();
    if (!url) return;
    await createTimelineEvent("workspace_link", wsLinkTitle.trim() || url, { url });
    setWsLinkUrl("");
    setWsLinkTitle("");
    tlQ.refetch();
  }

  async function runAiAnalysis() {
    if (!deal?.id) return;
    setAiRunError("");
    setAiRunLoading(true);
    try {
      await analyzeDealWithAi({
        dealId: deal.id,
        userId: auth?.id,
        taskCode: "deal_analysis",
        context: {
          deal_id: deal.id,
          title: deal.title || "",
          stage: deal?.expand?.stage_id?.stage_name || "",
          company: deal?.expand?.company_id?.name || "",
          company_inn: deal?.expand?.company_id?.inn || "",
          company_city: deal?.expand?.company_id?.city || "",
          responsible_name:
            deal?.expand?.responsible_id?.name ||
            deal?.expand?.responsible_id?.full_name ||
            deal?.expand?.responsible_id?.email ||
            "",
          budget: deal.budget ?? null,
          turnover: deal.turnover ?? null,
          margin_percent: deal.margin_percent ?? null,
          discount_percent: deal.discount_percent ?? null,
          sales_channel: deal.sales_channel || "",
          partner: deal.partner || "",
          distributor: deal.distributor || "",
          purchase_format: deal.purchase_format || "",
          activity_type: deal.activity_type || "",
          endpoints: deal.endpoints ?? null,
          infrastructure_size: deal.infrastructure_size || "",
          presale: deal.presale || "",
          attraction_channel: deal.attraction_channel || "",
          attraction_date: deal.attraction_date || "",
          registration_deadline: deal.registration_deadline || "",
          test_start: deal.test_start || "",
          test_end: deal.test_end || "",
          delivery_date: deal.delivery_date || "",
          expected_payment_date: deal.expected_payment_date || "",
          payment_received_date: deal.payment_received_date || "",
          project_map_link: deal.project_map_link || "",
          kaiten_link: deal.kaiten_link || "",
          current_score: deal.current_score ?? null,
          current_recommendations: deal.current_recommendations ?? null,
        },
      });
      await Promise.all([aiQ.refetch(), tlQ.refetch(), dealQ.refetch()]);
    } catch (e) {
      setAiRunError(e instanceof Error ? e.message : "Ошибка AI-анализа");
    } finally {
      setAiRunLoading(false);
    }
  }

  const latestAi = ((aiQ.data ?? [])[0] ?? null) as AiInsight | null;
  const score = resolveDisplayScore(latestAi);
  const sb = scoreBadge(score);
  const dynamicSections = React.useMemo(() => buildDynamicSections(latestAi), [latestAi]);

  const tlAll = (tlQ.data ?? []) as Array<TimelineItem & { expand?: { user_id?: { name?: string; email?: string } } }>;
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
                {stages.map((s) => (
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
        <div className="col-span-12 min-w-0 xl:col-span-8 grid gap-4">
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
                    {tlFiltered.map((t) => (
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
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-text2">
                    Контакты по сделке (ручные + из парсера). Можно добавлять вручную.
                  </div>
                  <Button onClick={() => setContactModal(true)}>
                    + Контакт
                  </Button>
                </div>

                <div className="mt-4 grid gap-3">
                  {(contactsQ.data || []).map((c: ContactFound) => {
                    const src = String(c.source_type || "");
                    const isManual = src === "manual";
                    const meta = [c.position, c.influence_type].filter(Boolean).join(" · ");
                    return (
                      <div key={c.id} className="rounded-card border border-border bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-semibold truncate">{c.full_name || "—"}</div>
                              {src ? <Badge>{src === "manual" ? "manual" : src}</Badge> : null}
                              {c.is_verified ? <Badge>verified</Badge> : null}
                            </div>
                            {meta ? <div className="text-xs text-text2 mt-1">{meta}</div> : null}
                            <div className="mt-2 grid gap-1 text-sm">
                              {c.phone ? <div>📞 {c.phone}</div> : null}
                              {c.email ? <div>✉️ {c.email}</div> : null}
                              {c.telegram ? <div>💬 {c.telegram}</div> : null}
                              {c.source_url ? (
                                <a className="text-sm text-primary underline" href={c.source_url} target="_blank" rel="noreferrer">
                                  источник
                                </a>
                              ) : null}
                            </div>
                          </div>
                          {isManual ? (
                            <Button
                              variant="ghost"
                              onClick={async () => {
                                await deleteContactM.mutateAsync({ id: c.id, dealId: id! }).catch(() => null);
                                contactsQ.refetch();
                              }}
                            >
                              Удалить
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {!contactsQ.isLoading && !(contactsQ.data || []).length ? (
                    <div className="text-sm text-text2">Контактов пока нет. Нажми “+ Контакт”.</div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "notes" ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Заметки</div>
                <div className="text-xs text-text2 mt-1">Здесь отображаются заметки и комментарии из правого блока.</div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {tlAll
                    .filter((t) => {
                      const a = String(t.action || "");
                      return a === "comment" || a === "note";
                    })
                    .map((t) => (
                      <div key={t.id} className="rounded-card border border-border bg-white p-3">
                        <div className="text-xs text-text2">
                          {dayjs(t.timestamp || t.created).format("DD.MM.YYYY HH:mm")}
                          {t.expand?.user_id?.name ? ` · ${t.expand.user_id.name}` : ""}
                          {String(t.action) === "note" ? " · note" : ""}
                        </div>
                        <div className="text-sm mt-2 whitespace-pre-wrap">{t.comment}</div>
                      </div>
                    ))}
                  {!tlAll.some((t) => String(t.action) === "comment" || String(t.action) === "note") ? (
                    <div className="text-sm text-text2">Заметок пока нет. Добавь комментарий справа — он появится здесь.</div>
                  ) : null}
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
                <div className="grid gap-4">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <div className="text-xs text-text2 mb-2">Ссылки</div>
                      <div className="flex gap-2">
                        <Input value={wsLinkTitle} onChange={(e) => setWsLinkTitle(e.target.value)} placeholder="Название (опционально)" />
                        <Input value={wsLinkUrl} onChange={(e) => setWsLinkUrl(e.target.value)} placeholder="https://..." />
                        <Button onClick={addWorkspaceLink} disabled={!wsLinkUrl.trim()}>
                          Добавить
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {tlAll
                          .filter((t) => String(t.action) === "workspace_link")
                          .map((t) => {
                            const url = (t.payload && typeof t.payload === "object" && "url" in t.payload ? String((t.payload as Record<string, unknown>).url ?? "") : "");
                            return (
                              <div key={t.id} className="rounded-card border border-border bg-white p-3">
                                <div className="text-xs text-text2">{dayjs(t.timestamp || t.created).format("DD.MM.YYYY HH:mm")}</div>
                                <a className="text-sm text-primary underline break-all" href={url} target="_blank" rel="noreferrer">
                                  {t.comment || url}
                                </a>
                              </div>
                            );
                          })}
                        {!tlAll.some((t) => String(t.action) === "workspace_link") ? (
                          <div className="text-sm text-text2">Пока нет ссылок. Добавь первую сверху.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-6">
                      <div className="text-xs text-text2 mb-2">Документы (ссылкой)</div>
                      <div className="grid gap-2">
                        <Input value={wsTitle} onChange={(e) => setWsTitle(e.target.value)} placeholder="Название" />
                        <div className="flex gap-2">
                          <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="URL на файл (S3/Selectel/диск)" />
                          <Input value={wsTag} onChange={(e) => setWsTag(e.target.value)} placeholder="Тэг (опционально)" />
                          <Button onClick={addWorkspaceFile} disabled={!wsUrl.trim()}>
                            Добавить
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(entityFilesQ.data || []).map((ef: EntityFileLink) => {
                          const f = ef.expand?.file_id;
                          const url = f?.path || "";
                          return (
                            <div key={ef.id} className="rounded-card border border-border bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{f?.filename || "Файл"}</div>
                                  {ef.tag ? <div className="text-xs text-text2 mt-1">{ef.tag}</div> : null}
                                  {url ? (
                                    <a className="text-sm text-primary underline break-all" href={url} target="_blank" rel="noreferrer">
                                      {url}
                                    </a>
                                  ) : null}
                                </div>
                                <Button
                                  variant="ghost"
                                  onClick={async () => {
                                    await deleteEntityFileM
                                      .mutateAsync({ id: ef.id, entityType: "deal", entityId: id! })
                                      .catch(() => null);
                                    entityFilesQ.refetch();
                                  }}
                                >
                                  Удалить
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!entityFilesQ.isLoading && !(entityFilesQ.data || []).length ? (
                          <div className="text-sm text-text2">Документов пока нет. Добавь файл ссылкой сверху.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* SIDEBAR: комментарии; AI-отчёт вынесен на полную ширину ниже */}
        <div className="col-span-12 min-w-0 xl:col-span-4 grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Комментарии</div>
                <Badge>Все</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={composerType}
                      onChange={(e) => setComposerType(e.target.value as "comment" | "note" | "task")}
                      className="ui-input max-w-[140px]"
                      title="Тип"
                    >
                      <option value="comment">Чат</option>
                      <option value="note">Примечание</option>
                      <option value="task">Задача</option>
                    </select>

                    {composerType === "task" ? (
                      <DateTimePicker value={taskDueAt} onChange={setTaskDueAt} className="w-full" />
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={composerType === "task" ? "Текст задачи (например: Связаться)" : "Напишите комментарий…"}
                    />
                    <Button
                      onClick={submitComposer}
                      disabled={composerType === "task" ? !(comment.trim() && taskDueAt) : !comment.trim()}
                    >
                      {composerType === "task" ? "Поставить" : "Добавить"}
                    </Button>
                  </div>

                  {composerType === "task" ? (
                    <div className="text-xs muted">
                      Задача появится в колокольчике в нужное время и в календаре.
                    </div>
                  ) : null}
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
        </div>

        <div className="col-span-12 min-w-0">
          <Card className="border-infoBorder bg-infoBg">
            <CardHeader className="border-infoBorder">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Сигналы и риски</div>
                  <div className="text-xs text-text2 mt-1">Отчёт по сделке: структурированные блоки из ответа модели</div>
                </div>
                <Button onClick={runAiAnalysis} disabled={aiRunLoading || !deal?.id}>
                  {aiRunLoading ? "AI анализ..." : "Запустить AI-анализ"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiRunError ? <div className="text-sm text-danger mb-3">{aiRunError}</div> : null}
              {aiQ.isLoading ? (
                <div className="text-sm text-text2">Загрузка...</div>
              ) : latestAi ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{sb.label}</Badge>
                      <Badge>Compliance: Balanced</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text2">Score</div>
                      <div className="text-[26px] font-semibold leading-none text-text">{typeof score === "number" ? `${score}/100` : "—"}</div>
                      <div className="text-xs text-text2 mt-1">Версия: {latestAi.created ? dayjs(latestAi.created).format("DD.MM.YYYY") : "—"}</div>
                    </div>
                  </div>
                  {latestAi.summary ? (
                    <div className="rounded-xl border border-infoBorder bg-card/90 p-4 lg:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-text2">Резюме</div>
                      <div className="mt-3">
                        <SmartStringContent text={latestAi.summary} />
                      </div>
                    </div>
                  ) : null}
                  {latestAi.suggestions || latestAi.recommendations ? (
                    <div className="rounded-xl border border-infoBorder bg-card/90 p-4 lg:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-text2">Рекомендации</div>
                      <div className="mt-3">
                        <SmartStringContent text={String(latestAi.suggestions || latestAi.recommendations || "")} />
                      </div>
                    </div>
                  ) : null}
                  {latestAi.risks ? (
                    <div className="rounded-xl border border-infoBorder bg-card/90 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-text2">Риски</div>
                      <div className="mt-3">
                        <AiRisksVisual raw={latestAi.risks} />
                      </div>
                    </div>
                  ) : null}
                  {dynamicSections.map((section, idx) => (
                    <div
                      key={`${section.title}-${idx}`}
                      className={`rounded-xl border border-border bg-card/90 p-4 ${dynamicSections.length === 1 ? "lg:col-span-2" : ""}`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-text2">{section.title}</div>
                      <div className="mt-3 min-w-0">
                        <AiInsightSectionBody value={section.raw} />
                      </div>
                    </div>
                  ))}
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

      <Modal
        open={contactModal}
        title="Новый контакт"
        onClose={() => {
          setContactModal(false);
          setCError("");
        }}
      >
        <div className="grid gap-3">
          {cError ? <div className="text-sm text-danger">{cError}</div> : null}
          <FieldRow label="ФИО *">
            <Input value={cFullName} onChange={(e) => setCFullName(e.target.value)} placeholder="Иванов Иван" />
          </FieldRow>
          <FieldRow label="Должность">
            <Input value={cPosition} onChange={(e) => setCPosition(e.target.value)} placeholder="Начальник отдела..." />
          </FieldRow>
          <FieldRow label="Раб. телефон">
            <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="+7 ..." />
          </FieldRow>
          <FieldRow label="Email">
            <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="name@company.ru" />
          </FieldRow>
          <FieldRow label="Мессенджер">
            <Input value={cTelegram} onChange={(e) => setCTelegram(e.target.value)} placeholder="@username / tg" />
          </FieldRow>
          <FieldRow label="Роль">
            <Select value={cInfluence} onChange={setCInfluence}>
              <option value="">—</option>
              <option value="lpr">ЛПР</option>
              <option value="lvr">ЛВР</option>
              <option value="blocker">Блокер</option>
              <option value="influencer">Влияющий</option>
            </Select>
          </FieldRow>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setContactModal(false)}>
              Отмена
            </Button>
            <Button onClick={addContact} disabled={createContactM.isPending}>
              Создать
            </Button>
          </div>
          <div className="text-xs text-text2">
            Обязательное: ФИО + хотя бы один контакт (телефон/email/telegram). Контакт сохранится в <code>contacts_found</code> как <code>source_type=manual</code>.
          </div>
        </div>
      </Modal>
    </div>
  );
}
