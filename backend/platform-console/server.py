#!/usr/bin/env python3
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

DB_PATH = os.getenv("CONTROL_DB_PATH", "/opt/pb-control/pb_data/data.db")
HOST = os.getenv("PLATFORM_CONSOLE_HOST", "127.0.0.1")
PORT = int(os.getenv("PLATFORM_CONSOLE_PORT", "8181"))


INDEX_HTML = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Founder AI Console</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f3f5f9; margin: 0; color: #111827; }
    .wrap { max-width: 1100px; margin: 20px auto; padding: 0 12px; }
    .card { background: #fff; border: 1px solid #d9dee8; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    .muted { color: #6b7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #eef1f6; text-align: left; padding: 8px; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    .row > div { min-width: 220px; }
    .btn { background: #111827; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    input[type="text"], input[type="number"] { width: 100%; border: 1px solid #c7cfdb; border-radius: 8px; padding: 7px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Founder AI Console</h1>
    <div class="muted">Внешняя управляющая оболочка поверх control DB: доступы, лимиты, usage и cost по клиентам.</div>

    <div class="card">
      <h2>Глобальные AI настройки</h2>
      <div class="row">
        <div><label>Primary provider</label><input id="providerPrimary" type="text"/></div>
        <div><label>Fallback provider</label><input id="providerFallback" type="text"/></div>
        <div><label>Deal analysis model</label><input id="modelDeal" type="text"/></div>
        <div><label>Decision support model</label><input id="modelDecision" type="text"/></div>
      </div>
      <div class="row" style="margin-top:8px;">
        <div><label>Research model</label><input id="modelResearch" type="text"/></div>
        <div><label>Competitor model</label><input id="modelCompetitor" type="text"/></div>
        <div><label>Max requests/deal/day</label><input id="maxReq" type="number"/></div>
        <div><label>Temperature</label><input id="temperature" type="text"/></div>
      </div>
      <div style="margin-top:10px;">
        <button class="btn" onclick="saveSettings()">Сохранить настройки</button>
      </div>
    </div>

    <div class="card">
      <h2>Клиенты: usage + cost + AI доступы</h2>
      <table id="tbl">
        <thead>
          <tr>
            <th>Клиент</th>
            <th>Домeн</th>
            <th>Стоимость (мес, RUB)</th>
            <th>Запросы</th>
            <th>Токены (in/out)</th>
            <th>Модули</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <script>
    async function getJson(url, opts={}) {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }

    function moduleToggle(tenantCode, moduleCode, enabled) {
      return `<label style="display:block"><input type="checkbox" ${enabled ? "checked" : ""} onchange="toggleModule('${tenantCode}','${moduleCode}', this.checked)"> ${moduleCode}</label>`;
    }

    async function load() {
      const data = await getJson("/api/summary");
      const tbody = document.querySelector("#tbl tbody");
      tbody.innerHTML = "";
      for (const t of data.tenants) {
        const tr = document.createElement("tr");
        const mods = (t.modules || []).map(m => moduleToggle(t.code, m.module_code, m.enabled)).join("");
        tr.innerHTML = `
          <td>${t.name || t.code}<div class="muted">${t.code}</div></td>
          <td>${t.primary_domain || ""}</td>
          <td>${(t.month_cost_rub || 0).toFixed(2)}</td>
          <td>${t.request_count || 0}</td>
          <td>${t.input_tokens || 0} / ${t.output_tokens || 0}</td>
          <td>${mods || "-"}</td>
        `;
        tbody.appendChild(tr);
      }
      const s = data.settings || {};
      document.getElementById("providerPrimary").value = s["ai.provider.primary"] || "";
      document.getElementById("providerFallback").value = s["ai.provider.fallback"] || "";
      document.getElementById("modelDeal").value = s["ai.model.deal_analysis"] || "";
      document.getElementById("modelDecision").value = s["ai.model.decision_support"] || "";
      document.getElementById("modelResearch").value = s["ai.model.research_engine"] || "";
      document.getElementById("modelCompetitor").value = s["ai.model.competitor_strategy"] || "";
      document.getElementById("maxReq").value = s["ai.runtime.max_requests_per_deal_per_day"] || "";
      document.getElementById("temperature").value = s["ai.runtime.temperature"] || "";
    }

    async function toggleModule(tenant_code, module_code, enabled) {
      await getJson("/api/module", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({tenant_code, module_code, enabled})
      });
    }

    async function saveSettings() {
      const payload = {
        "ai.provider.primary": document.getElementById("providerPrimary").value,
        "ai.provider.fallback": document.getElementById("providerFallback").value,
        "ai.model.deal_analysis": document.getElementById("modelDeal").value,
        "ai.model.decision_support": document.getElementById("modelDecision").value,
        "ai.model.research_engine": document.getElementById("modelResearch").value,
        "ai.model.competitor_strategy": document.getElementById("modelCompetitor").value,
        "ai.runtime.max_requests_per_deal_per_day": document.getElementById("maxReq").value,
        "ai.runtime.temperature": document.getElementById("temperature").value,
      };
      await getJson("/api/settings", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      alert("Сохранено");
    }

    load().catch(err => alert("Ошибка загрузки: " + err.message));
  </script>
</body>
</html>
"""


def fetch_summary():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute(
        """
        SELECT t.code, t.name, t.primary_domain,
               COALESCE(m.total_cost_rub, 0) AS month_cost_rub,
               COALESCE(m.request_count, 0) AS request_count,
               COALESCE(m.input_tokens, 0) AS input_tokens,
               COALESCE(m.output_tokens, 0) AS output_tokens
        FROM tenants t
        LEFT JOIN (
          SELECT tenant_code,
                 SUM(total_cost_rub) AS total_cost_rub,
                 SUM(request_count) AS request_count,
                 SUM(input_tokens) AS input_tokens,
                 SUM(output_tokens) AS output_tokens
          FROM ai_usage_monthly
          WHERE period = strftime('%Y-%m', 'now')
          GROUP BY tenant_code
        ) m ON m.tenant_code = t.code
        WHERE t.status='active' OR t.is_active=1
        ORDER BY month_cost_rub DESC, t.code ASC
        """
    )
    tenants = [dict(r) for r in cur.fetchall()]

    for tenant in tenants:
        cur.execute(
            "SELECT module_code, enabled, override_limit_value FROM tenant_modules WHERE tenant_code=? ORDER BY module_code",
            (tenant["code"],),
        )
        tenant["modules"] = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT key, value FROM system_settings WHERE group_name='ai'")
    settings = {r["key"]: r["value"] for r in cur.fetchall()}
    con.close()
    return {"tenants": tenants, "settings": settings}


def update_module(payload):
    tenant_code = str(payload.get("tenant_code", "")).strip()
    module_code = str(payload.get("module_code", "")).strip()
    enabled = 1 if bool(payload.get("enabled")) else 0
    ts = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        "SELECT id FROM tenant_modules WHERE tenant_code=? AND module_code=?",
        (tenant_code, module_code),
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE tenant_modules SET enabled=?, source=?, updated=? WHERE id=?",
            (enabled, "founder_console_web", ts, row[0]),
        )
    else:
        rid = "r" + secrets.token_hex(7)
        cur.execute(
            """
            INSERT INTO tenant_modules (id, tenant_code, module_code, enabled, override_limit_value, source, notes, created, updated)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (rid, tenant_code, module_code, enabled, 0, "founder_console_web", "", ts, ts),
        )
    con.commit()
    con.close()
    return {"ok": True}


def update_settings(payload):
    ts = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    for key, value in payload.items():
        key = str(key)
        value = str(value)
        cur.execute("SELECT id FROM system_settings WHERE key=?", (key,))
        row = cur.fetchone()
        if row:
            cur.execute("UPDATE system_settings SET value=?, updated=? WHERE key=?", (value, ts, key))
        else:
            rid = "r" + secrets.token_hex(7)
            cur.execute(
                """
                INSERT INTO system_settings (id, key, value, description, group_name, is_public, created, updated)
                VALUES (?,?,?,?,?,?,?,?)
                """,
                (rid, key, value, "AI platform setting", "ai", 0, ts, ts),
            )
    con.commit()
    con.close()
    return {"ok": True}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status=200, body="", content_type="text/plain; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status, obj):
        self._send(status, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "/index.html":
            self._send(200, INDEX_HTML, "text/html; charset=utf-8")
            return
        if path == "/api/summary":
            try:
                self._json(200, fetch_summary())
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        self._send(404, "not found")

    def do_POST(self):
        path = urlparse(self.path).path
        n = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(n).decode("utf-8") if n > 0 else "{}"
        try:
            payload = json.loads(raw or "{}")
        except Exception:
            self._json(400, {"error": "invalid json"})
            return
        try:
            if path == "/api/module":
                self._json(200, update_module(payload))
                return
            if path == "/api/settings":
                self._json(200, update_settings(payload))
                return
            self._send(404, "not found")
        except Exception as e:
            self._json(500, {"error": str(e)})


def main():
    httpd = HTTPServer((HOST, PORT), Handler)
    print(f"Founder console running on http://{HOST}:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

