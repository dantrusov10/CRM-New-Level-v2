import { pb } from "./pb";

const AI_GATEWAY_URL =
  import.meta.env.VITE_AI_GATEWAY_URL ?? "https://control.nwlvl.ru/owner/api/public";

type AnalyzePayload = {
  dealId: string;
  userId?: string;
  taskCode?: string;
  context: Record<string, unknown>;
};

type AdminDashboardAnalyzePayload = {
  userId?: string;
  promptCode?: string;
  context: Record<string, unknown>;
};

function resolveTenantPbUrl() {
  const raw = (pb as unknown as { baseUrl?: string }).baseUrl ?? "/api";
  const base = new URL(raw, window.location.origin).toString().replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

export async function analyzeDealWithAi(payload: AnalyzePayload) {
  const tenantUserToken = pb.authStore.token || "";
  if (!tenantUserToken) {
    throw new Error("Пользователь не авторизован в CRM.");
  }

  const url = `${AI_GATEWAY_URL}/ai/analyze-deal`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 180_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: tenantUserToken,
      },
      body: JSON.stringify({
        deal_id: payload.dealId,
        user_id: payload.userId || "",
        task_code: payload.taskCode || "deal_analysis",
        tenant_pb_url: resolveTenantPbUrl(),
        context: payload.context,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка сети";
    throw new Error(
      `Ошибка подключения к AI Gateway (${url}). Проверь доступность сервиса и VITE_AI_GATEWAY_URL. Детали: ${message}`,
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { ok: false, error: text || `HTTP ${response.status}` };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(String(data.error ?? `HTTP ${response.status}`));
  }
  return data;
}

export async function analyzeAdminDashboardWithAi(payload: AdminDashboardAnalyzePayload) {
  const tenantUserToken = pb.authStore.token || "";
  if (!tenantUserToken) {
    throw new Error("Пользователь не авторизован в CRM.");
  }

  const url = `${AI_GATEWAY_URL}/ai/analyze-admin-dashboard`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: tenantUserToken,
      },
      body: JSON.stringify({
        user_id: payload.userId || "",
        prompt_code: payload.promptCode || "founder_dashboard_brief_v1",
        tenant_pb_url: resolveTenantPbUrl(),
        context: payload.context,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка сети";
    throw new Error(`Ошибка подключения к AI Gateway (${url}). Детали: ${message}`);
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { ok: false, error: text || `HTTP ${response.status}` };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(String(data.error ?? `HTTP ${response.status}`));
  }
  return data;
}

