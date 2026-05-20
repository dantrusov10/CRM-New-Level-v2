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

export function cleanActionText(line: string): string {
  return String(line || "")
    .replace(/^\s*\d+[\).\]]\s*/, "")
    .replace(/^\s*[-•*]\s*/, "")
    .replace(/["'`]/g, "")
    .replace(/\baction\b\s*:/gi, "Действие:")
    .replace(/\bowner\b\s*:/gi, "Ответственный:")
    .replace(/\bdeadline\b\s*:/gi, "Срок:")
    .replace(/\btopic\b\s*:/gi, "Тема:")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractNextActions(raw: unknown): string[] {
  const normalize = cleanActionText;
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
          if (parts.length) out.push(normalize(parts.join(" · ")));
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(raw);
    if (out.length) return Array.from(new Set(out)).slice(0, 6);
  }
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  if (!text) return [];
  if (typeof raw === "string") {
    const parsed = parseJsonLoose(text);
    if (parsed && typeof parsed === "object") return extractNextActions(parsed);
  }
  return text
    .split(/\n|;|•/)
    .map((line) => normalize(line))
    .filter((line) => line.length > 5)
    .slice(0, 6);
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
