import { AI_GATEWAY_URL, getTenantPocketBaseUrl } from "./env";
import { pb } from "./pb";

export type AnalyzeDealPayload = {
  deal_id: string;
  tenant_pb_url?: string;
  user_id?: string;
  task_code?: string;
  product_ids?: string[];
  /** Попадает в `run_ai_deal_analysis` → `_build_ai_context(..., context)` → JSON для LLM */
  context?: Record<string, unknown>;
};

/**
 * POST {VITE_AI_GATEWAY_URL}/ai/analyze-deal
 * Тело совместимо с platform-console: deal_id, tenant_pb_url, user_id, task_code, context, tenant_user_token (Bearer).
 */
export async function requestDealAiAnalysis(payload: AnalyzeDealPayload): Promise<Response> {
  const base = AI_GATEWAY_URL.trim();
  if (!base) {
    throw new Error("Не задан VITE_AI_GATEWAY_URL (база публичного AI API).");
  }
  const token = pb.authStore.token;
  if (!token) {
    throw new Error("Нет токена авторизации PocketBase.");
  }
  const tenant_pb_url = (payload.tenant_pb_url || getTenantPocketBaseUrl()).replace(/\/$/, "");
  const url = `${base}/ai/analyze-deal`;
  const deal_id = payload.deal_id;
  const product_ids = payload.product_ids ?? [];
  const body: Record<string, unknown> = {
    deal_id,
    tenant_pb_url,
    user_id: payload.user_id,
    task_code: payload.task_code ?? "deal_analysis",
    product_ids,
    dealId: deal_id,
    productIds: product_ids,
    context: payload.context && typeof payload.context === "object" ? payload.context : {},
  };
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}
