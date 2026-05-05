export const PB_URL = import.meta.env.VITE_PB_URL ?? "/api";

/** База URL публичного AI gateway (без завершающего /). Пример: https://control.nwlvl.ru/owner/api/public */
export const AI_GATEWAY_URL = (import.meta.env.VITE_AI_GATEWAY_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Абсолютный URL PocketBase для передачи в AI gateway (как в клиенте). */
export function getTenantPocketBaseUrl(): string {
  const u = (import.meta.env.VITE_PB_URL as string | undefined)?.trim() ?? "/api";
  if (/^https?:\/\//i.test(u)) return u.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${window.location.origin}${path}`.replace(/\/$/, "");
  }
  return u.replace(/\/$/, "");
}
