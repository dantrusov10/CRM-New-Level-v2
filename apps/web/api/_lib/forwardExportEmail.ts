import { pocketBaseUrl } from "./pbAuth";

export function exportEmailGatewayUrl(): string {
  const custom = (process.env.EXPORT_EMAIL_GATEWAY_URL || "").trim();
  if (custom) return custom;
  const ai = (process.env.VITE_AI_GATEWAY_URL || "https://control.nwlvl.ru/owner/api/public").replace(/\/+$/, "");
  if (ai.endsWith("/send-export-email")) return ai;
  return `${ai}/send-export-email`;
}

export async function forwardExportEmail(
  authorization: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = exportEmailGatewayUrl();
  const body = {
    ...payload,
    tenant_pb_url: payload.tenant_pb_url || pocketBaseUrl(),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = { raw: await res.text().catch(() => "") };
  }
  return { ok: res.ok && data.ok === true, status: res.status, data };
}
