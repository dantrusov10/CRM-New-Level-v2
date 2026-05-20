import type { AiInsight } from "../../../lib/types";

export type ParsedRisk = {
  name: string;
  description?: string;
  criticality?: string;
  probability?: number | null;
};

export type ScoringFactorRow = {
  code: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  valueDelta: number | null;
  contributionDelta: number | null;
};

export type ScoringExplainability = {
  methodLabel: string;
  finalProbability: number | null;
  probabilityDelta: number | null;
  llmRaw: number | null;
  factors: ScoringFactorRow[];
  hasPrevious: boolean;
};

function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(t.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
}

export type NextActionGroup = {
  title?: string;
  items: string[];
};

const ACTION_GROUP_LABELS: Record<string, string> = {
  quick_actions_1_7_days: "Ближайшие 7 дней",
  strategic_actions_2_4_weeks: "Стратегия на 2–4 недели",
  next_best_actions: "Следующие шаги",
  next_actions: "Следующие шаги",
  next_steps: "Следующие шаги",
  action_plan_7_14_30: "План на 7–14–30 дней",
  action_plan: "План действий",
  recommendations: "Рекомендации",
  entry_strategy: "Стратегия входа",
};

function actionGroupLabel(key: string): string | undefined {
  const k = key.trim().toLowerCase();
  if (ACTION_GROUP_LABELS[k]) return ACTION_GROUP_LABELS[k];
  if (/quick.*action/.test(k)) return "Ближайшие действия";
  if (/strategic.*action/.test(k)) return "Стратегические действия";
  if (/action.*plan/.test(k)) return "План действий";
  return undefined;
}

function dedupeActions(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const cleaned = cleanActionText(item);
    if (cleaned.length <= 5) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** Разбить строку с несколькими действиями (через запятую между предложениями). */
function splitActionBlob(text: string): string[] {
  const t = text.trim().replace(/^\[|\]$/g, "").trim();
  if (!t) return [];
  const byComma = t.split(/,\s*(?=[А-ЯA-ZЁ«"(])/).map((s) => s.trim()).filter((s) => s.length > 5);
  if (byComma.length > 1) return byComma;
  const byNewline = t.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 5);
  if (byNewline.length > 1) return byNewline;
  return t.length > 5 ? [t] : [];
}

function parsePseudoObjectActions(s: string): NextActionGroup[] {
  const groups: NextActionGroup[] = [];
  const re = /([a-z][a-z0-9_]*)\s*:\s*\[([\s\S]*?)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const key = m[1];
    const items = dedupeActions(splitActionBlob(m[2]));
    if (items.length) groups.push({ title: actionGroupLabel(key), items });
  }
  return groups;
}

function collectActionStrings(value: unknown, out: string[]): void {
  if (value == null) return;

  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return;
    if (t.startsWith("{") && t.includes(":") && t.includes("[")) {
      for (const g of parsePseudoObjectActions(t)) out.push(...g.items);
      return;
    }
    const parsed = parseJsonLoose(t);
    if (parsed !== null && typeof parsed === "object") {
      collectActionStrings(parsed, out);
      return;
    }
    if (t.includes("[") && t.includes("]")) {
      const inner = t.replace(/^[\s\S]*?\[/, "").replace(/\][\s\S]*$/, "");
      splitActionBlob(inner).forEach((s) => out.push(s));
      return;
    }
    splitActionBlob(t).forEach((s) => out.push(s));
    return;
  }

  if (Array.isArray(value)) {
    for (const el of value) {
      if (typeof el === "string") {
        splitActionBlob(el).forEach((s) => out.push(s));
      } else {
        collectActionStrings(el, out);
      }
    }
    return;
  }

  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const action = String(o.action ?? o.text ?? o["действие"] ?? "").trim();
    if (action) {
      const parts = [action];
      const owner = String(o.owner ?? o.responsible ?? o["ответственный"] ?? "").trim();
      const deadline = String(o.deadline ?? o["срок"] ?? "").trim();
      if (owner) parts.push(`Ответственный: ${owner}`);
      if (deadline) parts.push(`Срок: ${deadline}`);
      out.push(parts.join(". "));
      return;
    }
    for (const v of Object.values(o)) collectActionStrings(v, out);
  }
}

/** Группы следующих действий (без технических ключей в тексте). */
export function extractNextActionGroups(raw: unknown): NextActionGroup[] {
  if (raw == null || raw === "") return [];

  let data: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.startsWith("{") && t.includes(":") && t.includes("[")) {
      const pseudo = parsePseudoObjectActions(t);
      if (pseudo.length) return pseudo;
    }
    const parsed = parseJsonLoose(t);
    if (parsed !== null) data = parsed;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const groups: NextActionGroup[] = [];
    for (const [key, val] of Object.entries(o)) {
      if (key.startsWith("_") || ["score", "model", "usage", "token_usage", "scoring"].includes(key.toLowerCase())) {
        continue;
      }
      const items: string[] = [];
      collectActionStrings(val, items);
      const deduped = dedupeActions(items);
      if (deduped.length) groups.push({ title: actionGroupLabel(key), items: deduped });
    }
    if (groups.length) return groups.slice(0, 5);
  }

  const flat: string[] = [];
  collectActionStrings(data, flat);
  const items = dedupeActions(flat);
  return items.length ? [{ items: items.slice(0, 8) }] : [];
}

export function extractNextActionsFromInsight(insight: AiInsight | null): NextActionGroup[] {
  if (!insight) return [];
  const ex =
    insight.explainability && typeof insight.explainability === "object" && !Array.isArray(insight.explainability)
      ? (insight.explainability as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [insight.suggestions, insight.recommendations];
  if (ex) {
    for (const key of [
      "next_best_actions",
      "next_actions",
      "next_steps",
      "quick_actions_1_7_days",
      "strategic_actions_2_4_weeks",
      "action_plan_7_14_30",
      "action_plan",
      "recommendations",
      "entry_strategy",
    ]) {
      if (ex[key] != null) candidates.push(ex[key]);
    }
    const actionObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ex)) {
      if (/action|recommend|step|plan|strategy/i.test(k) && v != null && k !== "risks") {
        actionObj[k] = v;
      }
    }
    if (Object.keys(actionObj).length > 1) candidates.unshift(actionObj);
  }

  for (const src of candidates) {
    const groups = extractNextActionGroups(src);
    if (groups.some((g) => g.items.length)) return groups;
  }
  return [];
}

export function cleanActionText(line: string): string {
  return String(line || "")
    .replace(/^\s*[\[{]\s*/, "")
    .replace(/[\]}]\s*$/, "")
    .replace(/^[a-z][a-z0-9_]*\s*:\s*/i, "")
    .replace(/^\s*\d+[\).\]]\s*/, "")
    .replace(/^\s*[-•*]\s*/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\baction\b\s*:/gi, "Действие:")
    .replace(/\bowner\b\s*:/gi, "Ответственный:")
    .replace(/\bdeadline\b\s*:/gi, "Срок:")
    .replace(/\btopic\b\s*:/gi, "Тема:")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractNextActions(raw: unknown): string[] {
  return extractNextActionGroups(raw).flatMap((g) => g.items).slice(0, 8);
}

const METHOD_LABELS: Record<string, string> = {
  weighted_factors_v1: "Взвешенные факторы CRM",
  weighted_factors: "Взвешенные факторы",
  llm_only: "Оценка модели",
  hybrid: "Гибридная модель (CRM + ИИ)",
};

const FACTOR_LABELS: Record<string, string> = {
  stage_progress: "Прогресс по этапам сделки",
  decision_maker_coverage: "Покрытие ЛПР/ЛВР",
  activity_freshness: "Свежесть активности",
  budget_clarity: "Определенность бюджета",
  pilot_status: "Статус пилота/пресейла",
  competition_pressure: "Конкурентное давление",
  data_completeness: "Полнота данных CRM",
};

export function scoringMethodLabel(method: unknown): string {
  const key = String(method || "").trim().toLowerCase();
  if (!key) return "—";
  return METHOD_LABELS[key] || "Скоринг по факторам CRM";
}

export function factorLabel(code: string, name: string): string {
  const c = String(code || "").toLowerCase();
  return FACTOR_LABELS[c] || name || code || "Фактор";
}

function extractScoringBlock(insight: AiInsight | null): Record<string, unknown> | null {
  const ex = insight?.explainability;
  if (!ex || typeof ex !== "object" || Array.isArray(ex)) return null;
  const s = (ex as Record<string, unknown>)._scoring;
  return s && typeof s === "object" ? (s as Record<string, unknown>) : null;
}

function breakdownRows(scoring: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!scoring || !Array.isArray(scoring.breakdown)) return [];
  return scoring.breakdown as Array<Record<string, unknown>>;
}

export function buildScoringExplainability(
  latest: AiInsight | null,
  previous: AiInsight | null,
): ScoringExplainability | null {
  const current = extractScoringBlock(latest);
  if (!current) return null;

  const prev = extractScoringBlock(previous);
  const prevByCode = new Map<string, Record<string, unknown>>();
  for (const f of breakdownRows(prev)) {
    prevByCode.set(String(f.code || ""), f);
  }

  const finalProbability = Number(current.final_probability);
  const prevFinal = prev ? Number(prev.final_probability) : NaN;
  const probabilityDelta =
    Number.isFinite(finalProbability) && Number.isFinite(prevFinal) ? finalProbability - prevFinal : null;

  const allFactors: ScoringFactorRow[] = breakdownRows(current).map((f) => {
    const code = String(f.code || "");
    const prevF = prevByCode.get(code);
    const value = Number(f.value ?? 0);
    const prevValue = prevF ? Number(prevF.value ?? 0) : NaN;
    const contribution = Number(f.weighted_contribution ?? 0);
    const prevContribution = prevF ? Number(prevF.weighted_contribution ?? 0) : NaN;
    return {
      code,
      label: factorLabel(code, String(f.name || "")),
      value: Number.isFinite(value) ? value : 0,
      weight: Number(f.weight ?? 0),
      contribution: Number.isFinite(contribution) ? contribution : 0,
      valueDelta: prevF && Number.isFinite(prevValue) ? value - prevValue : null,
      contributionDelta: prevF && Number.isFinite(prevContribution) ? contribution - prevContribution : null,
    };
  });

  const factors = prev
    ? allFactors
        .filter((f) => {
          const vd = f.valueDelta ?? 0;
          const cd = f.contributionDelta ?? 0;
          return Math.abs(vd) >= 0.5 || Math.abs(cd) >= 0.25;
        })
        .sort((a, b) => Math.abs(b.contributionDelta ?? 0) - Math.abs(a.contributionDelta ?? 0))
        .slice(0, 8)
    : allFactors.sort((a, b) => b.contribution - a.contribution).slice(0, 5);

  return {
    methodLabel: scoringMethodLabel(current.method),
    finalProbability: Number.isFinite(finalProbability) ? finalProbability : null,
    probabilityDelta,
    llmRaw: Number.isFinite(Number(current.llm_probability_raw)) ? Number(current.llm_probability_raw) : null,
    factors,
    hasPrevious: Boolean(prev),
  };
}

function criticalityLabel(v: string): string {
  const k = v.trim().toLowerCase();
  if (k === "high" || k === "высокая") return "Высокая";
  if (k === "medium" || k === "средняя") return "Средняя";
  if (k === "low" || k === "низкая") return "Низкая";
  return v;
}

function isRiskObject(o: Record<string, unknown>): boolean {
  return Boolean(
    (o.name || o.title) &&
      (o.description != null || o.criticality != null || o.probability != null),
  );
}

export function parseRiskItems(raw: unknown): ParsedRisk[] {
  if (raw == null) return [];
  let data = raw;
  if (typeof raw === "string") {
    const parsed = parseJsonLoose(raw.trim());
    if (parsed != null) data = parsed;
    else if (raw.trim()) return [{ name: raw.trim() }];
  }
  if (Array.isArray(data)) {
    const out: ParsedRisk[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        const t = String(item ?? "").trim();
        if (t) out.push({ name: t });
        continue;
      }
      const o = item as Record<string, unknown>;
      if (!isRiskObject(o)) continue;
      out.push({
        name: String(o.name ?? o.title ?? "Риск").trim(),
        description: String(o.description ?? o.details ?? "").trim() || undefined,
        criticality: o.criticality != null ? criticalityLabel(String(o.criticality)) : undefined,
        probability: o.probability != null && Number.isFinite(Number(o.probability)) ? Number(o.probability) : null,
      });
    }
    return out.slice(0, 8);
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (isRiskObject(o)) {
      return [
        {
          name: String(o.name ?? o.title ?? "Риск").trim(),
          description: String(o.description ?? "").trim() || undefined,
          criticality: o.criticality != null ? criticalityLabel(String(o.criticality)) : undefined,
          probability: o.probability != null && Number.isFinite(Number(o.probability)) ? Number(o.probability) : null,
        },
      ];
    }
    return Object.values(o)
      .flatMap((v) => parseRiskItems(v))
      .slice(0, 8);
  }
  return [];
}

export function extractRisksFromInsight(insight: AiInsight | null): ParsedRisk[] {
  if (!insight) return [];
  const ex =
    insight.explainability && typeof insight.explainability === "object" && !Array.isArray(insight.explainability)
      ? (insight.explainability as Record<string, unknown>)
      : {};
  const merged = parseRiskItems(ex.risks ?? insight.risks ?? "");
  return merged;
}

export function formatDelta(value: number | null, suffix = ""): string {
  if (value === null || !Number.isFinite(value)) return "";
  if (Math.abs(value) < 0.05) return "без изменений";
  const sign = value > 0 ? "+" : "";
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${sign}${rounded}${suffix}`;
}
