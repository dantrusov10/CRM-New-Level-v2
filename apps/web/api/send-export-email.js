const GATEWAY =
  process.env.EXPORT_EMAIL_GATEWAY_URL ||
  "https://control.nwlvl.ru/owner/api/public/send-export-email";

function pbApiBase() {
  const raw = (process.env.POCKETBASE_URL || "https://pb.nwlvl.ru").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function header(req, name) {
  const v = req.headers[name.toLowerCase()] ?? req.headers[name];
  if (Array.isArray(v)) return v[0] || "";
  return String(v || "");
}

function readBody(req) {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

async function verifyToken(token) {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return false;
  try {
    const res = await fetch(`${pbApiBase()}/collections/users/auth-refresh`, {
      method: "POST",
      headers: { Authorization: t },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }
    const authHeader = header(req, "authorization");
    if (!(await verifyToken(authHeader))) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
    const body = readBody(req);
    const to = String(body.to || "").trim();
    const filename = String(body.filename || "export.xlsx").trim() || "export.xlsx";
    const contentBase64 = String(body.contentBase64 || "").trim();
    if (!to || !contentBase64) {
      res.status(400).json({ ok: false, error: "bad_request" });
      return;
    }
    const upstream = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ to, filename, contentBase64, tenant_pb_url: pbApiBase() }),
    });
    const text = await upstream.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    if (!upstream.ok || !data.ok) {
      res.status(upstream.status >= 400 ? upstream.status : 503).json({ ok: false, error: data.error || data });
      return;
    }
    res.status(200).json({ ok: true, provider: data.provider || "control-smtp", from: data.from });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
