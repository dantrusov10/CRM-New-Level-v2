export function pocketBaseUrl(): string {
  const raw = (process.env.POCKETBASE_URL || process.env.MONITOR_PB_URL || "https://app.nwlvl.ru/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

/** Проверка JWT пользователя CRM (Authorization: TOKEN). */
export async function verifyPbUserToken(token: string): Promise<{ ok: boolean; userId?: string; role?: string }> {
  const t = token.replace(/^Bearer\s+/i, "").trim();
  if (!t) return { ok: false };
  try {
    const res = await fetch(`${pocketBaseUrl()}/collections/users/auth-refresh`, {
      method: "POST",
      headers: { Authorization: t },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { record?: { id?: string; role?: string } };
    return { ok: true, userId: data.record?.id, role: data.record?.role };
  } catch {
    return { ok: false };
  }
}

export function servicePbToken(): string {
  return (process.env.POCKETBASE_SERVICE_TOKEN || "").trim();
}
