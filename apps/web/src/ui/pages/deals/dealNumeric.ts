import type { Deal } from "../../../lib/types";

/** Нормализация числа из PB (number | string с пробелами). */
export function parseDealNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function dealBudget(deal: Deal): number | null {
  return parseDealNumber(deal.budget);
}

export function dealTurnover(deal: Deal): number | null {
  return parseDealNumber(deal.turnover);
}
