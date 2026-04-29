import React from "react";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
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
  useProductProfiles,
} from "../../data/hooks";
import { DealKpModule } from "../../modules/kp/DealKpModule";
import { DynamicEntityFormWithRef, DynamicEntityFormHandle } from "../../components/DynamicEntityForm";
import type { AiInsight, Deal, TimelineItem } from "../../../lib/types";
import type { ContactFound, EntityFileLink } from "../../data/hooks";
import { analyzeDealWithAi } from "../../../lib/aiGateway";

type AnyObj = Record<string, unknown>;
type TimelinePayload = Record<string, unknown>;
type AiSection = { key: string; title: string; raw: unknown };
type ResearchSection = { title: string; items: string[] };
type TimelineWithAuthor = TimelineItem & { expand?: { user_id?: { name?: string; email?: string } } };
type AiScenario = "deal_analysis" | "decision_support" | "client_research" | "semantic_enrichment" | "tender_tz_analysis";

function normalizeAiText(input: string): string {
  return String(input || "")
    .replace(/данн\w*\s*гап\w*/gi, "Пробелы в данных")
    .replace(/data\s*gaps?/gi, "Пробелы в данных");
}

/** Убирает вложенный JSON / ```json из полей, которые модель иногда «вкладывает» в summary. */
function humanizeSummaryForDisplay(raw: string | undefined | null): string {
  let t = String(raw || "").trim();
  if (!t) return "";
  t = t.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_, inner: string) => {
    const parsed = parseJsonLoose(String(inner || "").trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      const innerSummary = String(o.executive_summary || o.summary || "").trim();
      if (innerSummary) return innerSummary;
    }
    return String(inner || "").trim().slice(0, 4000);
  });
  const linesDedup = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (linesDedup.length >= 2 && linesDedup[0] === linesDedup[1]) {
    t = linesDedup.slice(1).join("\n");
  }
  t = t.replace(/^Кратко:\s*/i, "").trim();
  return t;
}

function isClientResearchInsight(insight: AiInsight | null): boolean {
  if (!insight) return false;
  const m = String(insight.model || "").toLowerCase();
  if (m.includes("client_research")) return true;
  const ex = insight.explainability;
  if (ex && typeof ex === "object" && !Array.isArray(ex)) {
    const o = ex as Record<string, unknown>;
    if (o._crm_narrative_md != null) return true;
    if (o.executive_summary != null || o.stakeholders_map != null || o.action_plan_7_14_30 != null) return true;
  }
  return false;
}

function stripTimelineAiNoise(text: string): string {
  return humanizeSummaryForDisplay(text);
}

function InlineMdBold({ text }: { text: string }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
          return (
            <strong key={i} className="font-semibold text-text">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return (
          <span key={i}>
            {p}
          </span>
        );
      })}
    </>
  );
}

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
  const trimmed = normalizeAiText(text).trim();
  if (!trimmed) return null;
  const whole = parseJsonLoose(trimmed);
  if (whole !== null && typeof whole !== "string") {
    return <AiStructuredValue value={whole} />;
  }
  const blocks = trimmed.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 3) {
      return (
        <ul className="grid gap-1.5 text-sm leading-relaxed">
          {lines.map((line, idx) => (
            <li key={`${line}-${idx}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      );
    }
    return <div className="text-sm whitespace-pre-wrap leading-relaxed text-text">{text}</div>;
  }
  return (
    <div className="grid gap-3 2xl:text-[13px]">
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
  const aliases: Record<string, string> = {
    data_gaps: "Пробелы в данных",
    "data gaps": "Пробелы в данных",
    "данные гапы": "Пробелы в данных",
    "data gap": "Пробелы в данных",
    probability: "Вероятность",
    criticality: "Критичность",
    description: "Описание",
    current_score: "Текущий score",
  };
  const normalized = String(key || "").trim().toLowerCase();
  if (aliases[normalized]) return aliases[normalized];
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
    "data gaps": "Чего не хватает",
    "данные гапы": "Чего не хватает",
    data_gap: "Чего не хватает",
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

function explainabilityFactorLabel(code: string, name: string): string {
  const c = String(code || "").toLowerCase();
  const map: Record<string, string> = {
    stage_progress: "Прогресс по этапам сделки",
    decision_maker_coverage: "Покрытие ЛПР/ЛВР",
    activity_freshness: "Свежесть активности",
    budget_clarity: "Определенность бюджета",
    pilot_status: "Статус пилота/пресейла",
    competition_pressure: "Конкурентное давление",
    data_completeness: "Полнота данных CRM",
  };
  return map[c] || name || code || "Фактор";
}

function explainabilityFactorComment(value: number): string {
  if (value >= 80) return "Сильный позитивный сигнал";
  if (value >= 60) return "Умеренно позитивный сигнал";
  if (value >= 40) return "Нейтральный/нестабильный сигнал";
  return "Зона риска, требует действий";
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
  if (typeof value === "string") return normalizeAiText(value).trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeExternalUrl(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  if (s.startsWith("/")) {
    try {
      return new URL(s, window.location.origin).toString();
    } catch {
      return "";
    }
  }
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    return "";
  } catch {
    return "";
  }
}

function openExternalUrl(raw: string) {
  const url = normalizeExternalUrl(raw);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function downloadExternalUrl(raw: string, filename?: string) {
  const url = normalizeExternalUrl(raw);
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function extractActionItems(raw: unknown): string[] {
  if (raw && typeof raw === "object") {
    const out: string[] = [];
    const walk = (v: unknown) => {
      if (!v) return;
      if (Array.isArray(v)) {
        v.forEach(walk);
        return;
      }
      if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        const action = String(o.action ?? o["действие"] ?? "").trim();
        const topic = String(o.topic ?? o["тема"] ?? "").trim();
        const deadline = String(o.deadline ?? o["срок"] ?? "").trim();
        if (action || topic || deadline) {
          const parts = [action, topic ? `Тема: ${topic}` : "", deadline ? `Срок: ${deadline}` : ""].filter(Boolean);
          if (parts.length) out.push(parts.join(" · "));
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(raw);
    if (out.length) return Array.from(new Set(out)).slice(0, 6);
  }
  const text = valueToText(raw);
  if (!text) return [];
  // Parse JSON only for string input to avoid recursive loops for object values.
  if (typeof raw === "string") {
    const parsed = parseJsonLoose(text);
    if (parsed && typeof parsed === "object") {
      return extractActionItems(parsed);
    }
  }
  return text
    .split(/\n|;|•|-/)
    .map((line) => line.trim())
    .filter((line) => line.length > 5)
    .slice(0, 4);
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
    "_crm_narrative_md",
    "_update_penalty",
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

function collectItemsByKeywords(sections: AiSection[], keywords: RegExp): string[] {
  const out: string[] = [];
  for (const section of sections) {
    const source = `${section.key} ${section.title}`.toLowerCase();
    if (!keywords.test(source)) continue;
    const text = valueToText(section.raw);
    if (!text) continue;
    out.push(
      ...text
        .split(/\n|;|•|-/)
        .map((line) => line.trim())
        .filter((line) => line.length > 6),
    );
  }
  return Array.from(new Set(out)).slice(0, 6);
}

/** Убирает обрамляющие кавычки у строк плана / выгрузки модели. */
function stripDecorativeQuotes(s: string): string {
  let t = String(s || "").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

const STAKEHOLDER_SLOT_RU: Record<string, string> = {
  champion: "Чемпион сделки",
  economic_buyer: "Экономический заказчик",
  lpr: "ЛПР",
  partner: "Партнёр",
  technical_buyer: "Технический заказчик",
  blockers: "Блокеры",
  influencers: "Влиятельные стороны",
  decision_committee: "Комитет по решению",
};

function humanizeSourceRef(ref: string): string {
  const r = ref.trim();
  if (!r || r.toLowerCase().startsWith("internal")) return "";
  if (/^crm:/i.test(r)) return r.replace(/^crm:\s*/i, "Данные CRM: ");
  if (/public_web_signals:/i.test(r)) return r.replace(/^public_web_signals:\s*/i, "Публичный источник: ");
  return `Источник: ${r}`;
}

/** Одна запись массива или вложенный объект → связные русские строки (без JSON). */
function formatResearchRecordToLines(item: unknown): string[] {
  if (item == null) return [];
  if (typeof item === "string") {
    const t = stripDecorativeQuotes(item);
    const parsed = parseJsonLoose(t);
    if (parsed !== null && typeof parsed === "object") {
      return formatResearchRecordToLines(parsed);
    }
    const h = humanizeSummaryForDisplay(t);
    return h.length > 4 ? [h] : [];
  }
  if (Array.isArray(item)) {
    return item.flatMap((x) => formatResearchRecordToLines(x)).filter((s) => s.length > 4);
  }
  if (typeof item !== "object") {
    return [String(item)].filter((s) => s.length > 4);
  }
  const o = item as Record<string, unknown>;

  if ("pain" in o || ("evidence" in o && "hypothesis" in o)) {
    const pain = String(o.pain ?? "").trim();
    const ev = String(o.evidence ?? "").trim();
    const ref = humanizeSourceRef(String(o.source_ref ?? o.source ?? ""));
    const hyp = o.hypothesis === true ? "Гипотеза. " : "";
    const parts = [hyp + (pain || "Потребность не названа")];
    if (ev) parts.push(`Обоснование: ${ev}`);
    if (ref) parts.push(ref);
    return [parts.join(" ")];
  }

  if ("gap" in o) {
    const gap = String(o.gap ?? "").trim();
    const how = String(o.how_to_get ?? "").trim();
    const owner = String(o.owner ?? "").trim();
    const parts = [];
    if (gap) parts.push(`Пробел: ${gap}`);
    if (how) parts.push(`Как закрыть: ${how}`);
    if (owner) parts.push(`Ответственный: ${owner}`);
    return parts.length ? [parts.join(" ")] : [];
  }

  if ("source" in o || "url" in o) {
    const name = String(o.source ?? o.title ?? "").trim();
    const url = String(o.url ?? "").trim();
    if (url.toLowerCase().startsWith("internal://")) {
      return [name ? `${name} (запись в CRM)` : "Внутренняя запись в CRM"];
    }
    if (name && url) return [`${name} — ${url}`];
    if (url) return [url];
    if (name) return [name];
    return [];
  }

  const name = String(o.name ?? o.title ?? "").trim();
  const role = String(o.role ?? o.position ?? "").trim();
  const inf = String(o.influence ?? "").trim();
  const foc = String(o.focus ?? "").trim();
  const blk = String(o.blocker_potential ?? "").trim();
  if (name) {
    const bits = [role ? `${name} — ${role}` : name];
    if (inf) bits.push(`влияние: ${inf}`);
    if (foc) bits.push(`фокус: ${foc}`);
    if (blk) bits.push(`риск блокировки: ${blk}`);
    return [bits.join(". ")];
  }

  return [];
}

function formatStakeholdersMapObject(obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [slot, raw] of Object.entries(obj)) {
    if (raw == null || raw === "") continue;
    const label = STAKEHOLDER_SLOT_RU[slot.toLowerCase()] || toSectionTitle(slot);
    if (Array.isArray(raw)) {
      for (const el of raw) {
        const sub = formatResearchRecordToLines(el);
        sub.forEach((s) => lines.push(`${label}: ${s}`));
      }
      continue;
    }
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const v = raw as Record<string, unknown>;
      const name = String(v.name ?? "").trim();
      const role = String(v.role ?? "").trim();
      const inf = String(v.influence ?? "").trim();
      const acc = String(v.access_level ?? "").trim();
      const bp = String(v.blocker_potential ?? "").trim();
      const foc = String(v.focus ?? "").trim();
      const bits = [`${label}`];
      if (name) bits.push(name + (role ? `, ${role}` : ""));
      if (inf) bits.push(`влияние ${inf}`);
      if (acc) bits.push(`доступ: ${acc}`);
      if (bp) bits.push(`блокер: ${bp}`);
      if (foc) bits.push(`фокус: ${foc}`);
      lines.push(bits.join(" — "));
      continue;
    }
    if (typeof raw === "string") {
      lines.push(`${label}: ${humanizeSummaryForDisplay(raw)}`);
    }
  }
  return lines.filter((s) => s.length > 6);
}

function researchFieldToReadableLines(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") {
    const t = val.trim();
    const parsed = parseJsonLoose(t);
    if (parsed !== null && typeof parsed === "object") {
      return researchFieldToReadableLines(parsed);
    }
    return humanizeSummaryForDisplay(t)
      .split(/\n+/)
      .map((s) => stripDecorativeQuotes(s.replace(/^[-•*]\s*/, "").trim()))
      .filter((s) => s.length > 6)
      .slice(0, 16);
  }
  if (Array.isArray(val)) {
    return val.flatMap((item) => formatResearchRecordToLines(item)).filter((s) => s.length > 4).slice(0, 16);
  }
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if ("pain" in o || "gap" in o) {
      return formatResearchRecordToLines(o);
    }
    if ("url" in o || ("source" in o && typeof o.source === "string")) {
      return formatResearchRecordToLines(o);
    }
    if (typeof o.name === "string" && o.name.trim()) {
      return formatResearchRecordToLines(o);
    }
    const entries = Object.entries(o).filter(([, v]) => v != null && v !== "");
    const nestedStakeholders = entries.some(
      ([, v]) => v && typeof v === "object" && !Array.isArray(v) && ("name" in (v as object) || "role" in (v as object)),
    );
    if (nestedStakeholders) {
      return formatStakeholdersMapObject(o);
    }
    return entries
      .flatMap(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          return formatResearchRecordToLines(v).map((line) => `${toSectionTitle(k)}: ${line}`);
        }
        return [`${toSectionTitle(k)}: ${stripDecorativeQuotes(String(v))}`];
      })
      .filter((s) => s.length > 6)
      .slice(0, 16);
  }
  return [];
}

function markdownToPlainTextForManager(md: string): string {
  return String(md || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildClientResearchTemplate(latestAi: AiInsight | null, planLines: string[]): ResearchSection[] {
  const ex = (
    latestAi?.explainability && typeof latestAi.explainability === "object" && !Array.isArray(latestAi.explainability)
      ? latestAi.explainability
      : {}
  ) as Record<string, unknown>;
  const summary = humanizeSummaryForDisplay(String(latestAi?.summary || ""));
  const score = resolveDisplayScore(latestAi);
  const sections: ResearchSection[] = [];
  sections.push({
    title: "Краткое резюме",
    items: summary ? [stripDecorativeQuotes(summary)] : ["Резюме пока пустое — см. детализацию источника ниже."],
  });
  const ctx = researchFieldToReadableLines(ex.business_context);
  if (ctx.length) sections.push({ title: "Контекст клиента и сделки", items: ctx });
  const stake = researchFieldToReadableLines(ex.stakeholders_map);
  if (stake.length) sections.push({ title: "Стейкхолдеры и блокеры", items: stake });
  const pains = [...researchFieldToReadableLines(ex.pains_confirmed), ...researchFieldToReadableLines(ex.pains_hypotheses)].slice(0, 12);
  if (pains.length) sections.push({ title: "Потребности: факты и гипотезы", items: pains });
  const risks = researchFieldToReadableLines(ex.risks);
  if (risks.length) sections.push({ title: "Риски", items: risks });
  if (typeof score === "number") {
    sections.push({
      title: "Оценка вероятности (модель)",
      items: [
        `Текущая оценка закрытия: ${score}%.`,
        "Для исследования клиента это ориентир по данным CRM и сигналам, а не замена глубокой внешней проверки.",
      ],
    });
  }
  const plan =
    planLines.length > 0
      ? planLines.map((l) => stripDecorativeQuotes(l)).slice(0, 8)
      : researchFieldToReadableLines(ex.action_plan_7_14_30 ?? ex.entry_strategy);
  if (plan.length) sections.push({ title: "План действий", items: plan });
  const gaps = researchFieldToReadableLines(ex.data_gaps);
  if (gaps.length) sections.push({ title: "Пробелы в данных", items: gaps });
  const src = researchFieldToReadableLines(ex.sources);
  if (src.length) sections.push({ title: "Источники и ссылки", items: src.slice(0, 10) });
  return sections.length ? sections : [{ title: "Исследование", items: [summary || "Структурированный ответ модели отсутствует."] }];
}

function buildResearchTemplate(
  latestAi: AiInsight | null,
  aiHistory: AiInsight[],
  timeline: TimelineWithAuthor[],
  sections: AiSection[],
  nextActions: string[],
  score: number | null,
): ResearchSection[] {
  if (isClientResearchInsight(latestAi)) {
    const sugLines = humanizeSummaryForDisplay(String(latestAi?.suggestions || ""))
      .split(/\n+/)
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter((l) => l.length > 10);
    const plan = sugLines.length ? sugLines : nextActions;
    return buildClientResearchTemplate(latestAi, plan);
  }
  const improvements = collectItemsByKeywords(sections, /(рост|улучш|upside|потенциал|сильн)/i);
  const deteriorations = collectItemsByKeywords(sections, /(риск|ухудш|проблем|gap|нехват|блокер)/i);
  const causes = collectItemsByKeywords(sections, /(причин|контекст|коммер|потреб|конкур|данн)/i);
  const summaryText = humanizeSummaryForDisplay(String(latestAi?.summary || ""));
  const prevAi = aiHistory.length > 1 ? aiHistory[1] : null;
  const prevScore = prevAi ? resolveDisplayScore(prevAi) : null;
  const delta = typeof score === "number" && typeof prevScore === "number" ? score - prevScore : null;
  const latestTimelineNote =
    timeline
      .filter((t) => String(t.action || "") === "comment" || String(t.action || "") === "note")
      .map((t) => String(t.comment || "").trim())
      .find(Boolean) || "";
  const latestTimelineAuthor =
    timeline
      .find((t) => (String(t.action || "") === "comment" || String(t.action || "") === "note") && String(t.comment || "").trim())
      ?.expand?.user_id?.name || "";

  return [
    {
      title: "Что улучшилось",
      items: improvements.length ? improvements : ["Явных улучшений в последнем срезе не зафиксировано."],
    },
    {
      title: "Что ухудшилось / риски",
      items: deteriorations.length ? deteriorations : ["Критических ухудшений не выявлено, требуется регулярный контроль рисков."],
    },
    {
      title: "Дельта вероятности",
      items: [
        typeof score === "number"
          ? `Текущая вероятность закрытия: ${score}%.`
          : "Вероятность закрытия пока не рассчитана.",
        delta != null
          ? `Изменение к прошлому AI-срезу: ${delta > 0 ? "+" : ""}${delta} п.п.`
          : "Недостаточно данных для сравнения с предыдущим AI-срезом.",
        summaryText ? `Контекст модели: ${summaryText.slice(0, 180)}${summaryText.length > 180 ? "..." : ""}` : "Недостаточно контекста для сравнения с предыдущим срезом.",
      ],
    },
    {
      title: "Последний апдейт в сделке (комментарии/заметки)",
      items: latestTimelineNote
        ? [
            latestTimelineAuthor ? `Автор: ${latestTimelineAuthor}.` : "Автор: не определен.",
            latestTimelineNote.slice(0, 220) + (latestTimelineNote.length > 220 ? "..." : ""),
          ]
        : ["После последнего AI-запуска нет новых зафиксированных комментариев/заметок."],
    },
    {
      title: "Ключевые причины",
      items: causes.length ? causes : ["Ключевые причины не структурированы в исходном AI-ответе."],
    },
    {
      title: "План действий 24-72ч",
      items: nextActions.length ? nextActions.slice(0, 5) : ["Запустить AI-анализ после обновления данных сделки и зафиксировать следующие шаги."],
    },
  ];
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

function TimelineText({ text }: { text: string }) {
  const raw = stripTimelineAiNoise(String(text || "").trim());
  if (!raw) return <span>—</span>;
  const recommendationJson = raw.match(/Рекомендации:\s*([\s\S]+)$/i);
  if (recommendationJson?.[1]) {
    const parsed = parseJsonLoose(recommendationJson[1].trim());
    const items = extractActionItems(parsed ?? recommendationJson[1]);
    const preface = raw
      .replace(/Рекомендации:\s*([\s\S]+)$/i, "")
      .trim();
    return (
      <div className="grid gap-2">
        {preface ? <div className="text-sm whitespace-pre-wrap">{preface}</div> : null}
        {items.length ? (
          <ul className="grid gap-1.5 text-sm">
            {items.map((item, idx) => (
              <li key={`${item}-${idx}`} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(engine|provider|insight id)\s*:/i.test(line));
  const listLike = lines.length >= 2 && lines.some((line) => /^(\d+[\).]|[-•])\s*/.test(line));
  if (listLike) {
    return (
      <ul className="grid gap-1.5 text-sm">
        {lines.map((line, idx) => (
          <li key={`${line}-${idx}`} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
            <span>{line.replace(/^(\d+[\).]|[-•])\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <div className="text-sm whitespace-pre-wrap">{raw}</div>;
}

function TimelineItemRow({ item }: { item: TimelineItem & { expand?: { user_id?: { name?: string; email?: string } } } }) {
  const ts = item.timestamp || item.created;
  const when = ts ? dayjs(ts).format("DD.MM.YYYY HH:mm") : "";
  const by = item.expand?.user_id?.name || item.expand?.user_id?.email || "";

  const action = String(item.action || "");
  const isComment = action === "comment";
  const isStage = action === "stage_change";
  const isAI = action.startsWith("ai");

  const tone = isComment
    ? "border-primary/35 bg-[rgba(51,215,255,0.08)]"
    : isStage
      ? "border-[rgba(45,123,255,0.35)] bg-[rgba(45,123,255,0.08)]"
      : isAI
        ? "border-infoBorder bg-infoBg"
        : "border-border bg-rowHover/60";
  const title = isComment ? "Комментарий" : isStage ? "Изменение этапа" : isAI ? "AI событие" : "Системное событие";
  const payloadRaw = item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : null;
  const isClientResearchAi = action === "ai_client_research";
  const payload = payloadRaw
    ? Object.entries(payloadRaw).filter(([k]) => {
        const kl = k.toLowerCase();
        if (["engine", "provider", "insight_id", "model"].includes(kl)) return false;
        if (isClientResearchAi && ["analysis_mode", "company_id", "product_id", "requested_task_code"].includes(kl)) return false;
        return true;
      })
    : [];
  const [expanded, setExpanded] = React.useState(isStage || isAI);

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-text2">{when}{by ? ` · ${by}` : ""}</div>
        <div className="flex items-center gap-2">
          <Badge>{title}</Badge>
          <Button small variant="secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Свернуть" : "Развернуть"}
          </Button>
        </div>
      </div>
      <div className="mt-2 text-sm font-medium">
        {String(item.comment || item.action || "").slice(0, 160) || "Событие"}
      </div>
      {expanded ? (
        <div className="mt-2 grid gap-2">
          <TimelineText text={String(item.comment || item.action || "")} />
          {payload.length ? (
            <div className="grid gap-1.5">
              {payload.map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-xs">
                  <span className="font-semibold">{toSectionTitle(k)}:</span>{" "}
                  <span className="text-text2">{valueToText(v) || "—"}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
  const productProfilesQ = useProductProfiles();

  const deal = (dealQ.data ?? null) as Deal | null;
  const stages = stagesQ.data ?? [];

  const [tab, setTab] = React.useState<string>("overview");
  const [composerType, setComposerType] = React.useState<"comment" | "note" | "task">("comment");
  const [comment, setComment] = React.useState<string>("");
  const [noteText, setNoteText] = React.useState<string>("");
  const [taskDueAt, setTaskDueAt] = React.useState<string>("");
  const [timelineFilter, setTimelineFilter] = React.useState<string>("all");
  const [aiRunLoading, setAiRunLoading] = React.useState(false);
  const [aiRunError, setAiRunError] = React.useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [latestTzByProduct, setLatestTzByProduct] = React.useState<Record<string, string>>({});
  const [productPickerOpen, setProductPickerOpen] = React.useState(false);
  const [analysisPickerOpen, setAnalysisPickerOpen] = React.useState(false);
  const [analysisSelection, setAnalysisSelection] = React.useState<string[]>([]);
  const [analysisMode, setAnalysisMode] = React.useState<"full" | "update">("full");
  const [clientResearchPickerOpen, setClientResearchPickerOpen] = React.useState(false);
  const [clientResearchProductId, setClientResearchProductId] = React.useState("");
  const [decisionSupportOpen, setDecisionSupportOpen] = React.useState(false);
  const [decisionSupportProductId, setDecisionSupportProductId] = React.useState("");
  const [decisionSupportIntent, setDecisionSupportIntent] = React.useState("next_step");
  const [decisionSupportQuestion, setDecisionSupportQuestion] = React.useState("");
  const [productFiles, setProductFiles] = React.useState<Array<{ id: string; profileId: string; profileName: string; filename: string; url: string; tag?: string }>>([]);
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
  const [editingContactId, setEditingContactId] = React.useState<string | null>(null);

  // Workspace add file/link
  const [wsTitle, setWsTitle] = React.useState("");
  const [wsUploadFile, setWsUploadFile] = React.useState<File | null>(null);
  const [wsUploadProductId, setWsUploadProductId] = React.useState<string>("");
  const [wsUploadError, setWsUploadError] = React.useState("");
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
    const dealProduct = String((deal as Record<string, unknown>)?.product_id || "");
    const cached = localStorage.getItem(`deal:${deal.id}:product_ids`) || "";
    const ids = cached
      ? cached.split(",").map((x) => x.trim()).filter(Boolean)
      : dealProduct
        ? [dealProduct]
        : [];
    setSelectedProductIds(ids);
    const cachedTz = localStorage.getItem(`deal:${deal.id}:latest_tz_by_product`) || "";
    if (cachedTz) {
      try {
        const parsed = JSON.parse(cachedTz) as Record<string, string>;
        setLatestTzByProduct(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setLatestTzByProduct({});
      }
    } else {
      setLatestTzByProduct({});
    }
  }, [deal?.id]);

  const productProfiles = React.useMemo(() => {
    return (productProfilesQ.data || []).map((p) => {
      const variants = p.variants && typeof p.variants === "object" && !Array.isArray(p.variants) ? p.variants as Record<string, unknown> : {};
      return {
        id: p.id,
        name: String(variants.name || "Без названия"),
        manufacturer: String(variants.manufacturer || ""),
        variants,
      };
    });
  }, [productProfilesQ.data]);

  const selectedProducts = React.useMemo(
    () => productProfiles.filter((p) => selectedProductIds.includes(p.id)),
    [productProfiles, selectedProductIds],
  );

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

  async function saveDealHeader() {
    if (!id) return;
    await pb
      .collection("deals")
      .update(id, {
        title: title.trim(),
        stage_id: deal?.stage_id || null,
      })
      .catch(() => null);
    await createTimelineEvent("deal_header_updated", "Обновлены название/этап сделки");
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

  async function saveSelectedProducts(nextIds: string[]) {
    if (!id) return;
    const clean = Array.from(new Set(nextIds.filter(Boolean)));
    setSelectedProductIds(clean);
    localStorage.setItem(`deal:${id}:product_ids`, clean.join(","));
    const primary = clean[0] || "";
    await pb.collection("deals").update(id, { product_id: primary || null }).catch(() => null);
    const productNames = productProfiles.filter((p) => clean.includes(p.id)).map((p) => p.name).join(", ") || "Не выбраны";
    await createTimelineEvent("products_selected", `Продукты сделки: ${productNames}`, { product_ids: clean });
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

  async function submitNoteFromNotesTab() {
    const text = noteText.trim();
    if (!text || !id) return;
    await createTimelineEvent("note", text);
    setNoteText("");
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

  async function saveContactChanges() {
    if (!editingContactId) return;
    const full_name = cFullName.trim();
    const phone = cPhone.trim();
    const email = cEmail.trim();
    const telegram = cTelegram.trim();
    if (!full_name) {
      setCError("Укажите имя контакта");
      return;
    }
    if (!phone && !email && !telegram) {
      setCError("Укажите хотя бы один контакт: телефон / email / Telegram");
      return;
    }
    await pb
      .collection("contacts_found")
      .update(editingContactId, {
        full_name,
        position: cPosition.trim(),
        phone,
        email,
        telegram,
        influence_type: cInfluence || "",
      })
      .catch(() => null);
    setContactModal(false);
    setEditingContactId(null);
    setCError("");
    contactsQ.refetch();
  }

  async function addWorkspaceUploadedFile() {
    if (!id || !wsUploadFile) return;
    setWsUploadError("");
    const readAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
    try {
      const dataUrl = await readAsDataUrl(wsUploadFile);
      const effectiveProduct = wsUploadProductId || selectedProductIds[0] || "";
      await addWorkspaceFileM
        .mutateAsync({
          entityType: "deal",
          entityId: id,
          url: dataUrl,
          title: wsTitle.trim() || wsUploadFile.name,
          tag: effectiveProduct ? `product_id:${effectiveProduct}` : "",
        })
        .catch(() => null);
      setWsUploadFile(null);
      setWsTitle("");
      setWsUploadProductId("");
      entityFilesQ.refetch();
    } catch {
      setWsUploadError("Не удалось загрузить файл. Попробуйте другой файл меньшего размера.");
    }
  }

  async function addWorkspaceLink() {
    if (!id) return;
    const url = normalizeExternalUrl(wsLinkUrl);
    if (!url) return;
    await createTimelineEvent("workspace_link", wsLinkTitle.trim() || url, { url });
    setWsLinkUrl("");
    setWsLinkTitle("");
    tlQ.refetch();
  }

  async function runAiAnalysis(mode: "full" | "update" = "full", scenario: AiScenario = "deal_analysis", forcedProductIds?: string[]) {
    if (!deal?.id) return;
    const effectiveProductIds = (forcedProductIds && forcedProductIds.length ? forcedProductIds : selectedProductIds).filter(Boolean);
    const effectivePrimaryProductId = effectiveProductIds[0] || (productProfiles.length === 1 ? productProfiles[0].id : "");
    if (!effectivePrimaryProductId && scenario !== "semantic_enrichment" && productProfiles.length > 1) return;
    if (!effectivePrimaryProductId && scenario !== "semantic_enrichment") {
      setAiRunError("Выберите продукт для сделки перед запуском AI-сценария.");
      return;
    }
    if (scenario === "client_research") {
      const companyKey = String(deal.company_id || deal.expand?.company_id?.id || "");
      const cooldownKey = `client_research:${companyKey}:${effectivePrimaryProductId}`;
      const raw = localStorage.getItem(cooldownKey);
      if (raw) {
        const nextAllowedTs = Number(raw);
        if (Number.isFinite(nextAllowedTs) && Date.now() < nextAllowedTs) {
          const d = dayjs(nextAllowedTs).format("DD.MM.YYYY");
          setAiRunError(`Исследование клиента уже запускалось для этой связки продукт+клиент. Следующий запуск после ${d}.`);
          return;
        }
      }
    }
    setAiRunError("");
    setAiRunLoading(true);
    try {
      const previousInsightId = String(((aiQ.data ?? [])[0] as AiInsight | undefined)?.id || "");
      const recentTimeline = ((tlQ.data ?? []) as TimelineWithAuthor[])
        .slice(0, 20)
        .map((t) => ({
          action: t.action,
          comment: String(t.comment || "").slice(0, 500),
          timestamp: t.timestamp || t.created || "",
          author: t.expand?.user_id?.name || t.expand?.user_id?.email || "",
        }));
      const recentNotes = recentTimeline
        .filter((t) => t.action === "comment" || t.action === "note")
        .slice(0, 8);
      const prevInsight = ((aiQ.data ?? [])[1] ?? null) as AiInsight | null;
      const lastCommentEntry = recentNotes.find((t) => t.action === "comment" || t.action === "note") || null;
      const lastCommentText = String(lastCommentEntry?.comment || "").trim();
      const effectiveProduct = productProfiles.find((p) => p.id === effectivePrimaryProductId) || null;
      const effectiveProductNames = productProfiles.filter((p) => effectiveProductIds.includes(p.id)).map((p) => p.name);
      const requestContext = {
        analysis_mode: mode,
        ai_scenario: scenario,
        deal_id: deal.id,
        company_id: deal.company_id || deal.expand?.company_id?.id || "",
        product_id: effectivePrimaryProductId,
        product_ids: effectiveProductIds,
        product_names: effectiveProductNames,
        latest_tz_file_by_product: latestTzByProduct,
        decision_support_intent: scenario === "decision_support" ? decisionSupportIntent : "",
        decision_support_question: scenario === "decision_support" ? decisionSupportQuestion.slice(0, 500) : "",
        product_profile: effectiveProduct?.variants || {},
        product_name: effectiveProduct?.name || "",
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
        recent_timeline_events: recentTimeline,
        recent_comments_notes: recentNotes,
        previous_ai_summary: prevInsight?.summary || "",
        previous_ai_suggestions: String(prevInsight?.suggestions || prevInsight?.recommendations || ""),
        previous_ai_score: resolveDisplayScore(prevInsight),
        output_contract: {
          required_fields: ["score", "summary", "suggestions", "risks"],
          min_summary_chars: 100,
          min_suggestions_items: 3,
          min_suggestion_chars: 60,
        },
        response_style:
          "Верни непустые summary и suggestions. Если данных мало — заполни кратким fallback по фактам сделки и последним комментариям.",
        latest_update_anchor: {
          timestamp: lastCommentEntry?.timestamp || "",
          text: lastCommentText.slice(0, 800),
          author: String(lastCommentEntry?.author || ""),
        },
        update_mandatory_rule:
          mode === "update"
            ? "В summary первой строкой обязательно укажи: 'Последнее изменение:' и перескажи последний комментарий/заметку своими словами. Если последнего изменения нет — явно напиши это."
            : "",
        update_focus: mode === "update"
          ? "Сфокусируйся только на изменениях после последнего анализа: что улучшилось/ухудшилось, как изменилась вероятность и что делать дальше."
          : "",
      };
      const aiResponse = await analyzeDealWithAi({
        dealId: deal.id,
        userId: auth?.id,
        taskCode: scenario,
        context: requestContext,
      });
      async function attachClientResearchReport(insight: { id?: string; summary?: string; suggestions?: string; explainability?: unknown }) {
        if (!id) return;
        const createdAt = dayjs().format("YYYY-MM-DD HH:mm");
        const productName = effectiveProduct?.name || "Продукт";
        const title = `AI client research ${deal.title || deal.id} ${dayjs().format("YYYY-MM-DD HH-mm")}.md`;
        const exObj =
          insight?.explainability && typeof insight.explainability === "object"
            ? (insight.explainability as Record<string, unknown>)
            : {};
        const narrative = String(exObj._crm_narrative_md || "").trim();
        const header = [
          `# Исследование клиента`,
          ``,
          `- Сделка: ${deal.title || deal.id}`,
          `- Компания: ${deal?.expand?.company_id?.name || "-"}`,
          `- Продукт: ${productName}`,
          `- Время: ${createdAt}`,
          ``,
        ].join("\n");
        const md = narrative.length
          ? [
              header,
              narrative,
              ``,
              `## Краткое резюме (для карточки CRM)`,
              `${humanizeSummaryForDisplay(String(insight?.summary || "").trim()) || "-"}`,
              ``,
              `## План и рекомендации`,
              `${String(insight?.suggestions || "").trim() || "-"}`,
              ``,
            ].join("\n")
          : [
              header,
              `## Краткое резюме`,
              `${humanizeSummaryForDisplay(String(insight?.summary || "").trim()) || "-"}`,
              ``,
              `## План и рекомендации`,
              `${String(insight?.suggestions || "").trim() || "-"}`,
              ``,
              `## Структурированные данные (сокращённо)`,
              "```json",
              (() => {
                const copy = { ...exObj };
                delete copy._scoring;
                delete copy._update_penalty;
                try {
                  return JSON.stringify(copy, null, 2).slice(0, 14000);
                } catch {
                  return "{}";
                }
              })(),
              "```",
              ``,
            ].join("\n");
        const bytes = new TextEncoder().encode(md);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        const dataUrl = `data:text/markdown;base64,${btoa(binary)}`;
        const titleTxt = title.replace(/\.md$/i, ".txt");
        const plainBody = markdownToPlainTextForManager(md);
        const txtBytes = new TextEncoder().encode(plainBody);
        let txtBinary = "";
        txtBytes.forEach((b) => {
          txtBinary += String.fromCharCode(b);
        });
        const txtDataUrl = `data:text/plain;charset=utf-8;base64,${btoa(txtBinary)}`;
        await addWorkspaceFileM
          .mutateAsync({
            entityType: "deal",
            entityId: id,
            url: dataUrl,
            title,
            tag: effectivePrimaryProductId ? `product_id:${effectivePrimaryProductId}` : "ai_client_research",
          })
          .catch(() => null);
        await addWorkspaceFileM
          .mutateAsync({
            entityType: "deal",
            entityId: id,
            url: txtDataUrl,
            title: titleTxt,
            tag: effectivePrimaryProductId ? `product_id:${effectivePrimaryProductId}` : "ai_client_research_txt",
          })
          .catch(() => null);
      }
      if (scenario === "client_research") {
        const companyKey = String(deal.company_id || deal.expand?.company_id?.id || "");
        const cooldownKey = `client_research:${companyKey}:${effectivePrimaryProductId}`;
        const nextAllowedTs = Date.now() + 180 * 24 * 60 * 60 * 1000;
        localStorage.setItem(cooldownKey, String(nextAllowedTs));
      }
      const isAsyncClientResearch = Boolean(scenario === "client_research" && aiResponse && (aiResponse as Record<string, unknown>).accepted === true);
      const maxAttempts = isAsyncClientResearch ? 90 : 6;
      const waitMs = isAsyncClientResearch ? 10000 : 1200;
      let appeared = false;
      let latestInsight: { id?: string; summary?: string; suggestions?: string; explainability?: unknown } | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const check = await pb
          .collection("ai_insights")
          .getList(1, 1, { filter: `deal_id="${deal.id}"`, sort: "-created" })
          .catch(() => null);
        const latest = ((check as { items?: Array<{ id?: string; summary?: string; suggestions?: string; explainability?: unknown }> } | null)?.items || [])[0];
        const latestId = String(latest?.id || "");
        if (latestId && latestId !== previousInsightId) {
          appeared = true;
          latestInsight = latest || null;
          break;
        }
        if (isAsyncClientResearch && attempt % 9 === 0) {
          await Promise.all([tlQ.refetch(), dealQ.refetch()]);
        }
        await sleep(waitMs);
      }
      await Promise.all([aiQ.refetch(), tlQ.refetch(), dealQ.refetch()]);
      if (appeared && scenario === "client_research" && latestInsight) {
        await attachClientResearchReport(latestInsight);
        entityFilesQ.refetch();
      }
      if (!appeared) {
        if (isAsyncClientResearch) {
          setAiRunError("Глубокое исследование запущено и выполняется в фоне (может занять 5-15+ минут). Обнови вкладку AI/Файлы чуть позже.");
        } else {
          setAiRunError(
            `AI ответ получен (${String(aiResponse?.provider || "")}:${String(aiResponse?.engine || "")}, score ${String(aiResponse?.score ?? "—")}), но новая запись не появилась в CRM. Проверь gateway логи и запись в коллекции ai_insights.`,
          );
        }
      }
    } catch (e) {
      setAiRunError(e instanceof Error ? e.message : "Ошибка AI-анализа");
    } finally {
      setAiRunLoading(false);
    }
  }

  const latestAi = ((aiQ.data ?? [])[0] ?? null) as AiInsight | null;
  const aiHistory = (aiQ.data ?? []) as AiInsight[];
  const tlAll = (tlQ.data ?? []) as Array<TimelineWithAuthor>;
  const score = resolveDisplayScore(latestAi);
  const sb = scoreBadge(score);
  const dynamicSections = React.useMemo(() => buildDynamicSections(latestAi), [latestAi]);
  const nextActions = React.useMemo(
    () => extractActionItems(latestAi?.suggestions || latestAi?.recommendations || ""),
    [latestAi],
  );
  const researchSections = React.useMemo(
    () => buildResearchTemplate(latestAi, aiHistory, tlAll, dynamicSections, nextActions, score),
    [latestAi, aiHistory, tlAll, dynamicSections, nextActions, score],
  );
  const hasRiskSignals =
    Boolean(latestAi?.risks) ||
    dynamicSections.some((section) => /риск|risk/i.test(section.key) || /риск|risk/i.test(section.title));
  const aiScoring = React.useMemo(() => {
    const ex = latestAi?.explainability;
    if (!ex || typeof ex !== "object" || Array.isArray(ex)) return null;
    const s = (ex as Record<string, unknown>)._scoring;
    return s && typeof s === "object" ? (s as Record<string, unknown>) : null;
  }, [latestAi?.explainability]);
  const latestAiTimelineEvent = React.useMemo(
    () =>
      tlAll.find((t) => {
        const action = String(t.action || "").toLowerCase();
        return action === "ai_analysis" || action === "ai_update_analysis";
      }) || null,
    [tlAll],
  );
  const latestAiMode = React.useMemo(() => {
    if (!latestAiTimelineEvent) return "full";
    const payload =
      latestAiTimelineEvent.payload && typeof latestAiTimelineEvent.payload === "object"
        ? (latestAiTimelineEvent.payload as Record<string, unknown>)
        : null;
    const payloadMode = String(payload?.analysis_mode || "").toLowerCase();
    if (payloadMode === "update") return "update";
    const action = String(latestAiTimelineEvent.action || "").toLowerCase();
    if (action === "ai_update_analysis") return "update";
    return "full";
  }, [latestAiTimelineEvent]);

  const tlFiltered = tlAll.filter((t) => {
    if (timelineFilter === "comments") return String(t.action) === "comment";
    if (timelineFilter === "ai") return String(t.action).startsWith("ai") || String(t.action) === "ai";
    if (timelineFilter === "system") return String(t.action) !== "comment";
    return true;
  });

  async function createTaskFromAction(actionText: string) {
    if (!deal?.id || !auth?.id) return;
    const due = dayjs().add(2, "day").hour(12).minute(0).second(0).millisecond(0).toISOString();
    await createTaskM
      .mutateAsync({
        title: actionText.slice(0, 180),
        due_at: due,
        deal_id: deal.id,
        company_id: deal?.company_id || deal?.expand?.company_id?.id,
        created_by: auth.id,
      })
      .catch(() => null);
    await createTimelineEvent("task_created", `Задача из AI: ${actionText.slice(0, 180)}`, { due_at: due, source: "ai_next_best_action" });
    tlQ.refetch();
  }

  async function loadProductFilesForDeal() {
    if (!selectedProductIds.length) {
      setProductFiles([]);
      return;
    }
    const rows: Array<{ id: string; profileId: string; profileName: string; filename: string; url: string; tag?: string }> = [];
    for (const pid of selectedProductIds) {
      const res = await pb.collection("entity_files").getList(1, 200, {
        filter: `entity_type="product_profile" && entity_id="${pid}"`,
        sort: "-created",
        expand: "file_id",
      }).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
      for (const item of (res.items || []) as Array<Record<string, unknown>>) {
        const file = item.expand && typeof item.expand === "object" ? (item.expand as Record<string, unknown>).file_id as Record<string, unknown> : null;
        const url = normalizeExternalUrl(String(file?.path || ""));
        const filename = String(file?.filename || "Файл");
        const profileName = productProfiles.find((p) => p.id === pid)?.name || "Продукт";
        rows.push({ id: String(item.id || ""), profileId: pid, profileName, filename, url, tag: String(item.tag || "") });
      }
    }
    setProductFiles(rows);
  }

  React.useEffect(() => {
    void loadProductFilesForDeal();
  }, [selectedProductIds.join(","), productProfiles.length]);

  async function setFileAsPrimaryTz(fileLinkId: string, productId: string) {
    if (!productId) return;
    setLatestTzByProduct((prev) => {
      const next = { ...prev, [productId]: fileLinkId };
      if (id) localStorage.setItem(`deal:${id}:latest_tz_by_product`, JSON.stringify(next));
      return next;
    });
    await createTimelineEvent("tz_primary_selected", "Выбран основной файл ТЗ", { entity_file_id: fileLinkId, product_id: productId }).catch(() => null);
  }

  function parseProductIdFromTag(tag: string): string {
    const s = String(tag || "");
    const m = s.match(/^product_id:(.+)$/);
    return m ? String(m[1] || "").trim() : "";
  }

  async function changeFileProduct(fileLinkId: string, productId: string) {
    await pb.collection("entity_files").update(fileLinkId, { tag: productId ? `product_id:${productId}` : "" }).catch(() => null);
    entityFilesQ.refetch();
  }

  return (
    <div className="grid gap-4">
      <Card className="neon-accent">
        <CardHeader>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold">Сделка</div>
              <span className="neon-pill">Карточка</span>
              <Badge>{deal?.expand?.company_id?.name ? "Компания: " + deal.expand.company_id.name : "Компания: —"}</Badge>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 xl:col-span-4">
                <div className="text-xs text-text2 mb-1">Название сделки</div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название сделки"
                />
              </div>
              <div className="col-span-12 xl:col-span-5">
                <div className="text-xs text-text2 mb-1">Этап сделки</div>
                <Select value={deal?.stage_id || ""} onChange={changeStage}>
                  <option value="">Этап</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stage_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-12 xl:col-span-3 grid gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setClientResearchProductId(selectedProductIds[0] || "");
                    setClientResearchPickerOpen(true);
                  }}
                  disabled={aiRunLoading || !deal?.id}
                >
                  Исследовать клиента
                </Button>
              </div>
              <div className="col-span-12 xl:col-span-2">
                <Button className="w-full" onClick={saveDealHeader} disabled={upd.isPending || !title.trim()}>
                  Сохранить
                </Button>
              </div>
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
                { key: "ai", label: "AI-анализ" },
                { key: "timeline", label: "Лента изменений" },
                { key: "relationship", label: "Контакты" },
                { key: "notes", label: "Заметки" },
                { key: "kp", label: "КП" },
                { key: "workspace", label: "Файлы" },
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
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Карточка сделки</div>
                  <span className="neon-pill">Основной блок</span>
                </div>
                <div className="text-xs text-text2 mt-1">Полностью настраивается в Админ → Поля (разделы + поля).</div>
                <div className="mt-2 neon-divider" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-12 gap-2 text-sm">
                    <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-card border border-border bg-white p-2">
                      <div className="text-xs text-text2">Компания</div>
                      <div className="mt-1 font-semibold">{deal?.expand?.company_id?.name || "—"}</div>
                    </div>
                    <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-card border border-border bg-white p-2">
                      <div className="text-xs text-text2">Ответственный</div>
                      <div className="mt-1 font-semibold">{deal?.expand?.responsible_id?.full_name || deal?.expand?.responsible_id?.email || "—"}</div>
                    </div>
                    <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-card border border-border bg-white p-2">
                      <div className="text-xs text-text2">Бюджет / Оборот</div>
                      <div className="mt-1 font-semibold">
                        {budget ? `${formatMoney(Number(budget))} ₽` : "—"} / {turnover ? `${formatMoney(Number(turnover))} ₽` : "—"}
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-card border border-border bg-white p-2">
                      <div className="text-xs text-text2">Основное: продукты сделки</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedProducts.length ? selectedProducts.map((p) => (
                          <Badge key={p.id}>{p.name}</Badge>
                        )) : <span className="text-sm text-text2">Не выбраны</span>}
                      </div>
                      <div className="mt-2">
                        <Button
                          small
                          variant="secondary"
                          onClick={() => {
                            setAnalysisSelection(selectedProductIds);
                            setProductPickerOpen(true);
                          }}
                        >
                          Выбрать продукты
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-card border border-border bg-white p-2">
                      <div className="text-xs text-text2">Ключевые даты</div>
                      <div className="mt-1 text-xs text-text2">
                        Рег.: {registrationDeadline || "—"}<br />
                        Тест: {testStart || "—"} → {testEnd || "—"}<br />
                        Оплата: {expectedPaymentDate || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 xl:col-span-7 max-w-[640px]">
                      <DynamicEntityFormWithRef
                        ref={formRef}
                        entity="deal"
                        record={deal}
                        onSaved={async () => {
                          await dealQ.refetch();
                          tlQ.refetch();
                        }}
                      />
                    </div>
                    <div className="col-span-12 xl:col-span-5 grid gap-2 self-start">
                      <div className="board-panel p-3">
                        <div className="text-xs text-text2">Статус</div>
                        <div className="mt-1 text-sm font-semibold">{deal?.expand?.stage_id?.stage_name || "Без этапа"}</div>
                      </div>
                      <div className="board-panel p-3">
                        <div className="text-xs text-text2">Канал / Партнер</div>
                        <div className="mt-1 text-sm">{salesChannel || "—"} / {partner || "—"}</div>
                      </div>
                      <div className="board-panel p-3">
                        <div className="text-xs text-text2">Контрольный чек-лист</div>
                        <ul className="mt-1 grid gap-1 text-sm">
                          <li>• Этап актуален</li>
                          <li>• Данные по финансам заполнены</li>
                          <li>• Контакты ЛПР/ЛВР добавлены</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "ai" ? (
            <Card className="border-infoBorder bg-infoBg neon-accent">
              <CardHeader className="border-infoBorder">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">AI-отчёт по сделке</div>
                      <span className="neon-pill">AI режим</span>
                    </div>
                    <div className="text-xs text-text2 mt-1">
                      {isClientResearchInsight(latestAi)
                        ? "Исследование клиента: резюме, контекст, стейкхолдеры, риски и план. Развёрнутый отчёт — в Markdown-файле в разделе «Файлы» (без сырого JSON в интерфейсе)."
                        : "Формат управленческого исследования: изменения, риски, причины, план"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button
                      onClick={() => {
                        setAnalysisMode("full");
                        setAnalysisSelection(selectedProductIds);
                        setAnalysisPickerOpen(true);
                      }}
                      disabled={aiRunLoading || !deal?.id}
                    >
                      {aiRunLoading ? "AI анализ..." : "Запустить AI-анализ"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAnalysisMode("update");
                        setAnalysisSelection(selectedProductIds);
                        setAnalysisPickerOpen(true);
                      }}
                      disabled={aiRunLoading || !deal?.id}
                    >
                      Обновить AI-анализ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {aiRunError ? <div className="text-sm text-danger mb-3">{aiRunError}</div> : null}
                {aiQ.isLoading ? (
                  <div className="text-sm text-text2">Загрузка...</div>
                ) : latestAi ? (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-12 lg:col-span-3 rounded-lg border border-[rgba(51,215,255,0.35)] bg-[rgba(45,123,255,0.16)] p-3">
                        <div className="text-xs text-text2">Вероятность</div>
                        <div className="mt-2 text-[28px] font-extrabold leading-none">{typeof score === "number" ? `${score}%` : "—"}</div>
                        <div className="mt-2"><Badge>{sb.label}</Badge></div>
                      </div>
                      <div className="col-span-12 lg:col-span-9 rounded-lg border border-border bg-rowHover/60 p-3">
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-text2">Последнее обновление AI</div>
                          <Badge>{latestAiMode === "update" ? "Режим: UPDATE" : "Режим: FULL"}</Badge>
                        </div>
                        <div className="mt-1 text-sm">{latestAi.created ? dayjs(latestAi.created).format("DD.MM.YYYY HH:mm") : "—"}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-infoBorder bg-card/90 p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text2">Исследование (фиксированный шаблон)</div>
                      <div className="grid gap-4">
                        {researchSections.map((section, idx) => (
                          <section key={`${section.title}-${idx}`} className="rounded-lg border border-border bg-rowHover/60 p-3">
                            <h4 className="text-sm font-semibold">{idx + 1}. {section.title}</h4>
                            <ul className="mt-2 grid gap-1.5 text-sm">
                              {section.items.map((item, i) => (
                                <li key={`${item}-${i}`} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
                                  <span className="leading-relaxed">
                                    <InlineMdBold text={item} />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    </div>
                    {aiScoring ? (
                      <div className="rounded-xl border border-border bg-card/90 p-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text2">Почему изменился score</div>
                        <div className="grid gap-2">
                          <div className="text-sm">
                            Метод: <span className="font-semibold">{String(aiScoring.method || "—")}</span> ·
                            Финальная вероятность: <span className="font-semibold">{String(aiScoring.final_probability ?? "—")}</span> ·
                            Сырой LLM: <span className="font-semibold">{String(aiScoring.llm_probability_raw ?? "—")}</span>
                          </div>
                          {Array.isArray(aiScoring.breakdown) ? (
                            <div className="grid gap-2">
                              {(aiScoring.breakdown as Array<Record<string, unknown>>).slice(0, 8).map((f, idx) => (
                                <div key={`${String(f.code || idx)}`} className="rounded-md border border-border bg-rowHover/60 px-3 py-2 text-sm">
                                  <div className="font-medium">
                                    {explainabilityFactorLabel(String(f.code || ""), String(f.name || ""))}
                                  </div>
                                  <div className="mt-1 h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.12)]">
                                    <div
                                      className="h-1.5 rounded-full bg-primary/80"
                                      style={{ width: `${Math.max(0, Math.min(100, Number(f.value ?? 0)))}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 text-xs text-text2">
                                    Оценка: {String(f.value ?? "—")} / 100 · Вес: {String(f.weight ?? "—")} · Вклад: {String(f.weighted_contribution ?? "—")}
                                  </div>
                                  <div className="text-xs text-text2">
                                    {explainabilityFactorComment(Number(f.value ?? 0))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {dynamicSections.length ? (
                      <details className="rounded-xl border border-border bg-card/90 p-4">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text2">
                          Детализация источника AI ({dynamicSections.length} секций)
                        </summary>
                        <div className="mt-3 rounded-lg border border-border bg-[rgba(255,255,255,0.02)] p-4">
                          <div className="grid gap-4">
                            {dynamicSections.map((section, idx) => (
                              <details key={`${section.title}-${idx}`} className="border-b border-border/60 pb-3 last:border-b-0 last:pb-0" open={idx < 2}>
                                <summary className="cursor-pointer text-sm font-semibold tracking-wide text-text">
                                  {idx + 1}. {section.title}
                                </summary>
                                <div className="mt-2 min-w-0 text-sm leading-relaxed">
                                  <AiInsightSectionBody value={section.raw} />
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-text2">
                    AI ещё не запускался. Интеграция агента делается через записи <code>ai_insights</code> и события в <code>timeline</code>.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === "timeline" ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">Лента изменений</div>
                      <span className="neon-pill">История сделки</span>
                    </div>
                    <div className="text-xs text-text2 mt-1">Явные модули по времени: что поменялось, кто автор, какие поля затронуты</div>
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
                <div className="text-sm font-semibold">Карточки контактов</div>
                <div className="text-xs text-text2 mt-1">Полноценные карточки: должность, роль, каналы связи, редактирование и удаление</div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-text2">
                    Контакты по сделке (ручные + из парсера). Можно добавлять вручную.
                  </div>
                  <Button
                    onClick={() => {
                      setEditingContactId(null);
                      setCError("");
                      setCFullName("");
                      setCPosition("");
                      setCPhone("");
                      setCEmail("");
                      setCTelegram("");
                      setCInfluence("");
                      setContactModal(true);
                    }}
                  >
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
                            {c.position ? <div className="text-xs text-text2 mt-1">Должность: {c.position}</div> : null}
                            <div className="mt-2 grid gap-1 text-sm">
                              {c.phone ? <div>📞 {c.phone}</div> : null}
                              {c.email ? <div>✉️ {c.email}</div> : null}
                              {c.telegram ? <div>💬 {c.telegram}</div> : null}
                              {normalizeExternalUrl(c.source_url || "") ? (
                                <a className="text-sm text-primary underline" href={normalizeExternalUrl(c.source_url || "")} target="_blank" rel="noreferrer">
                                  источник
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              small
                              variant="secondary"
                              onClick={() => {
                                setEditingContactId(c.id);
                                setCError("");
                                setCFullName(c.full_name || "");
                                setCPosition(c.position || "");
                                setCPhone(c.phone || "");
                                setCEmail(c.email || "");
                                setCTelegram(c.telegram || "");
                                setCInfluence(c.influence_type || "");
                                setContactModal(true);
                              }}
                            >
                              Открыть
                            </Button>
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
                <div className="text-xs text-text2 mt-1">Отдельный ввод заметок + история заметок/комментариев.</div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="rounded-card border border-border bg-rowHover p-3">
                    <div className="text-xs text-text2 mb-2">Новая заметка</div>
                    <div className="flex gap-2">
                      <Input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Напишите заметку по сделке..."
                      />
                      <Button onClick={submitNoteFromNotesTab} disabled={!noteText.trim()}>
                        Добавить
                      </Button>
                    </div>
                  </div>
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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Файлы</div>
                    <div className="text-xs text-text2 mt-1">Хранилище документов и ссылок по сделке</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void runAiAnalysis("full", "tender_tz_analysis", selectedProductIds)}
                      disabled={aiRunLoading || !selectedProductIds.length}
                    >
                      Анализ ТЗ
                    </Button>
                    <label className="ui-btn ui-btn-secondary h-9 px-3 cursor-pointer">
                      Загрузить
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setWsUploadFile(f);
                          if (f && !wsTitle.trim()) setWsTitle(f.name);
                        }}
                      />
                    </label>
                  </div>
                </div>
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
                            const url = normalizeExternalUrl(
                              t.payload && typeof t.payload === "object" && "url" in t.payload
                                ? String((t.payload as Record<string, unknown>).url ?? "")
                                : "",
                            );
                            return (
                              <div key={t.id} className="rounded-card border border-border bg-white p-3">
                                <div className="text-xs text-text2">{dayjs(t.timestamp || t.created).format("DD.MM.YYYY HH:mm")}</div>
                                <div className="text-sm">{t.comment || "Ссылка"}</div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Button small variant="secondary" onClick={() => openExternalUrl(url)}>
                                    Открыть ссылку
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        {!tlAll.some((t) => String(t.action) === "workspace_link") ? (
                          <div className="text-sm text-text2">Пока нет ссылок. Добавь первую сверху.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-6">
                      <div className="text-xs text-text2 mb-2">Документы</div>
                      <div className="grid gap-2">
                        <div className="text-xs text-text2 truncate">{wsUploadFile ? `Выбран файл: ${wsUploadFile.name}` : "Файл не выбран"}</div>
                        <Input value={wsTitle} onChange={(e) => setWsTitle(e.target.value)} placeholder="Название" />
                        <Select value={wsUploadProductId} onChange={setWsUploadProductId}>
                          <option value="">Продукт (опц.)</option>
                          {productProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </Select>
                        <div className="flex gap-2">
                          <Button onClick={addWorkspaceUploadedFile} disabled={!wsUploadFile}>
                            Добавить файл
                          </Button>
                        </div>
                        {wsUploadError ? <div className="text-xs text-danger">{wsUploadError}</div> : null}
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(entityFilesQ.data || []).map((ef: EntityFileLink) => {
                          const f = ef.expand?.file_id;
                          const url = normalizeExternalUrl(f?.path || "");
                          const fileProductId = parseProductIdFromTag(String(ef.tag || ""));
                          return (
                            <div key={ef.id} className="rounded-card border border-border bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{f?.filename || "Файл"}</div>
                                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <label className="flex items-center gap-2 text-xs text-text2">
                                      <input
                                        type="radio"
                                        className="h-5 w-5"
                                        name={`deal_primary_tz_file_${fileProductId || "none"}`}
                                        checked={Boolean(fileProductId) && latestTzByProduct[fileProductId] === ef.id}
                                        disabled={!fileProductId}
                                        onChange={() => { void setFileAsPrimaryTz(ef.id, fileProductId); }}
                                      />
                                      Осн. ТЗ
                                    </label>
                                    <Select
                                      value={parseProductIdFromTag(String(ef.tag || ""))}
                                      onChange={(v) => { void changeFileProduct(ef.id, v); }}
                                    >
                                      <option value="">Без продукта</option>
                                      {productProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </Select>
                                  </div>
                                  {url ? (
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                      <Button small variant="secondary" onClick={() => openExternalUrl(url)}>
                                        Открыть
                                      </Button>
                                      <Button small variant="secondary" onClick={() => downloadExternalUrl(url, String(f?.filename || "file"))}>
                                        Скачать
                                      </Button>
                                    </div>
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

                    <div className="col-span-12">
                      <div className="rounded-card border border-border bg-rowHover p-3">
                        <div className="text-sm font-semibold mb-2">Файлы выбранных продуктов</div>
                        <div className="grid gap-2">
                          {productFiles.map((pf) => (
                            <div key={pf.id} className="rounded-card border border-border bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-text2">{pf.profileName}{pf.tag ? ` · ${pf.tag}` : ""}</div>
                                  <div className="text-sm font-semibold truncate">{pf.filename}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button small variant="secondary" onClick={() => downloadExternalUrl(pf.url, pf.filename)}>
                                    Скачать
                                  </Button>
                                  <label className="flex items-center gap-2 text-xs text-text2">
                                    <input
                                      type="radio"
                                      className="h-5 w-5"
                                      name={`latest_tz_file_${pf.profileId}`}
                                      checked={latestTzByProduct[pf.profileId] === pf.id}
                                      onChange={() => { void setFileAsPrimaryTz(pf.id, pf.profileId); }}
                                    />
                                    Последнее ТЗ
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                          {!productFiles.length ? <div className="text-sm text-text2">По выбранным продуктам файлы пока не добавлены.</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* SIDEBAR: decision rail + комментарии */}
        <div className="col-span-12 min-w-0 xl:col-span-4 grid gap-4 self-start">
          <Card className="neon-accent">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Контур решений</div>
                  <div className="text-xs text-text2 mt-1">Ключевой контур: AI + следующий шаг</div>
                </div>
                <span className="neon-pill">Приоритет</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="rounded-card border border-[rgba(51,215,255,0.35)] bg-[rgba(45,123,255,0.16)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-text2">Текущий score</div>
                    <Badge>{sb.label}</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold">{typeof score === "number" ? `${score}/100` : "—"}</div>
                </div>

                <Button
                  onClick={() => {
                    setAnalysisMode("full");
                    setAnalysisSelection(selectedProductIds);
                    setAnalysisPickerOpen(true);
                  }}
                  disabled={aiRunLoading || !deal?.id}
                  className="neon-accent"
                >
                  {aiRunLoading ? "AI анализ..." : "Запустить AI-анализ"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAnalysisMode("update");
                    setAnalysisSelection(selectedProductIds);
                    setAnalysisPickerOpen(true);
                  }}
                  disabled={aiRunLoading || !deal?.id}
                >
                  Обновить AI-анализ
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDecisionSupportProductId(selectedProductIds[0] || "");
                    setDecisionSupportOpen(true);
                  }}
                  disabled={aiRunLoading || !deal?.id}
                >
                  Поддержка решения
                </Button>

                <div className="rounded-card border border-border bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text2 mb-2">Следующие действия</div>
                  {nextActions.length ? (
                    <ul className="grid gap-1.5 text-sm">
                      {nextActions.slice(0, 3).map((item, idx) => (
                        <li key={`${item}-${idx}`} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" />
                          <div className="flex-1 flex items-start justify-between gap-2">
                            <span className="leading-relaxed">{item}</span>
                            <Button small variant="secondary" onClick={() => void createTaskFromAction(item)}>
                              В задачу
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-text2">Запусти AI, чтобы получить action list.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">Комментарии</div>
                  <span className="neon-pill">Быстрые заметки</span>
                </div>
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

                <div className="crm-scrollbar grid gap-3 max-h-[420px] overflow-y-auto pr-1">
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

      </div>

      <Modal
        open={contactModal}
        title={editingContactId ? "Карточка контакта" : "Новый контакт"}
        onClose={() => {
          setContactModal(false);
          setEditingContactId(null);
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
            <Button
              onClick={editingContactId ? saveContactChanges : addContact}
              disabled={createContactM.isPending}
            >
              {editingContactId ? "Сохранить" : "Создать"}
            </Button>
          </div>
          <div className="text-xs text-text2">
            Обязательное: ФИО + хотя бы один контакт (телефон/email/telegram). Контакт сохранится в <code>contacts_found</code> как <code>source_type=manual</code>.
          </div>
        </div>
      </Modal>
      <Modal
        open={productPickerOpen}
        title="Выберите продукты сделки"
        onClose={() => {
          setProductPickerOpen(false);
        }}
      >
        <div className="grid gap-3">
          <div className="text-sm text-text2">
            Отметьте один или несколько продуктов. Эти продукты будут использоваться в контексте сделки по умолчанию.
          </div>
          <div className="grid gap-2">
            {productProfiles.map((p) => (
              <label
                key={p.id}
                className="text-left rounded-md border border-border bg-white px-3 py-2 hover:border-primary/50 flex items-start gap-2"
              >
                <input
                  type="checkbox"
                  checked={analysisSelection.includes(p.id)}
                  onChange={(e) => {
                    setAnalysisSelection((prev) => e.target.checked ? Array.from(new Set([...prev, p.id])) : prev.filter((x) => x !== p.id));
                  }}
                />
                <div>
                <div className="text-sm font-semibold">{p.name}</div>
                {p.manufacturer ? <div className="text-xs text-text2 mt-1">{p.manufacturer}</div> : null}
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProductPickerOpen(false)}>Отмена</Button>
            <Button
              onClick={async () => {
                await saveSelectedProducts(analysisSelection);
                setProductPickerOpen(false);
              }}
            >
              Сохранить выбор
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={analysisPickerOpen}
        title={analysisMode === "update" ? "Обновить AI-анализ" : "Запустить AI-анализ"}
        onClose={() => setAnalysisPickerOpen(false)}
      >
        <div className="grid gap-3">
          <div className="text-sm text-text2">Выберите продукты для анализа этой комплексной сделки.</div>
          <div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1">
            {productProfiles.map((p) => (
              <label key={p.id} className="rounded-md border border-border bg-white px-3 py-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={analysisSelection.includes(p.id)}
                  onChange={(e) => setAnalysisSelection((prev) => e.target.checked ? Array.from(new Set([...prev, p.id])) : prev.filter((x) => x !== p.id))}
                />
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  {p.manufacturer ? <div className="text-xs text-text2">{p.manufacturer}</div> : null}
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAnalysisPickerOpen(false)}>Отмена</Button>
            <Button
              disabled={!analysisSelection.length}
              onClick={async () => {
                setAnalysisPickerOpen(false);
                await runAiAnalysis(analysisMode, "deal_analysis", analysisSelection);
              }}
            >
              Запустить
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={clientResearchPickerOpen}
        title="Исследовать клиента"
        onClose={() => setClientResearchPickerOpen(false)}
      >
        <div className="grid gap-3">
          <div className="text-sm text-text2">Выберите один продукт для исследования клиента (лимит 1 раз в 6 месяцев на связку клиент+продукт).</div>
          <Select value={clientResearchProductId} onChange={setClientResearchProductId}>
            <option value="">Выберите продукт</option>
            {productProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClientResearchPickerOpen(false)}>Отмена</Button>
            <Button
              disabled={!clientResearchProductId}
              onClick={async () => {
                setClientResearchPickerOpen(false);
                await runAiAnalysis("full", "client_research", [clientResearchProductId]);
              }}
            >
              Запустить исследование
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={decisionSupportOpen}
        title="Поддержка решения"
        onClose={() => setDecisionSupportOpen(false)}
      >
        <div className="grid gap-3">
          <div className="text-sm text-text2">Быстрый ассистент следующего шага. Лимит: не более 10 запусков в месяц на одну сделку.</div>
          <Select value={decisionSupportProductId} onChange={setDecisionSupportProductId}>
            <option value="">Выберите продукт</option>
            {productProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select value={decisionSupportIntent} onChange={setDecisionSupportIntent}>
            <option value="next_step">Следующий шаг</option>
            <option value="objection_reply">Ответ на возражение</option>
            <option value="message_draft">Черновик сообщения/письма</option>
            <option value="call_plan">План звонка</option>
          </Select>
          <Input
            value={decisionSupportQuestion}
            onChange={(e) => setDecisionSupportQuestion(e.target.value)}
            placeholder="Контекст запроса (опционально)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDecisionSupportOpen(false)}>Отмена</Button>
            <Button
              disabled={!decisionSupportProductId}
              onClick={async () => {
                setDecisionSupportOpen(false);
                await runAiAnalysis("full", "decision_support", [decisionSupportProductId]);
              }}
            >
              Запустить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
