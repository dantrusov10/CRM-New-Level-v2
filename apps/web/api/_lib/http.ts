export type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string | Record<string, unknown>;
};

export type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

export function readJsonBody(req: Req): Record<string, unknown> {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function header(req: Req, name: string): string {
  const v = req.headers[name.toLowerCase()] ?? req.headers[name];
  if (Array.isArray(v)) return v[0] || "";
  return String(v || "");
}
