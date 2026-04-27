#!/usr/bin/env python3
import csv
import io
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import parse_qs, urlparse

DB_PATH = os.getenv("CONTROL_DB_PATH", "/opt/pb-control/pb_data/data.db")
HOST = os.getenv("PLATFORM_CONSOLE_HOST", "127.0.0.1")
PORT = int(os.getenv("PLATFORM_CONSOLE_PORT", "8181"))
OWNER_USER = os.getenv("PLATFORM_CONSOLE_USER", "founder")
OWNER_PASSWORD = os.getenv("PLATFORM_CONSOLE_PASSWORD", "ChangeMe_123!")
SESSION_TTL_HOURS = int(os.getenv("PLATFORM_CONSOLE_SESSION_TTL_HOURS", "24"))
SECRETS_FILE = os.getenv("PLATFORM_AI_SECRETS_FILE", "/opt/pb-control/.ai-provider-secrets.json")
TENANT_PB_ADMIN_EMAIL = os.getenv("TENANT_PB_ADMIN_EMAIL", "dantrusov10@yandex.ru")
TENANT_PB_ADMIN_PASSWORD = os.getenv("TENANT_PB_ADMIN_PASSWORD", "Dan@4007Dan@4007")
PUBLIC_AI_ALLOWED_ORIGINS = os.getenv(
    "PUBLIC_AI_ALLOWED_ORIGINS", "https://app.nwlvl.ru,https://nwlvl.ru,http://localhost:5173"
)

SESSIONS = {}
PUBLIC_AI_RATE_LIMIT = {}


INDEX_HTML = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Кабинет управления AI</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f3f5f9; margin: 0; color: #111827; }
    .wrap { max-width: 1150px; margin: 20px auto; padding: 0 12px; }
    .card { background: #fff; border: 1px solid #d9dee8; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    h3 { font-size: 14px; margin: 8px 0 6px; }
    .muted { color: #6b7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #eef1f6; text-align: left; padding: 8px; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    .row > div { min-width: 220px; }
    .btn { background: #111827; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    input[type="text"], input[type="number"], input[type="password"] { width: 100%; border: 1px solid #c7cfdb; border-radius: 8px; padding: 7px; }
    .hidden { display: none; }
    .err { color: #b91c1c; font-size: 13px; margin-top: 8px; }
    .ok { color: #047857; font-size: 13px; margin-top: 8px; }
    .hint { color: #6b7280; font-size: 12px; margin-top: 3px; }
    .task { border: 1px solid #eef1f6; border-radius: 8px; padding: 10px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>ЛК AI-управления</h1>
    <div class="muted">Все ключи и настройки хранятся на сервере. Интерфейс не показывает токены в открытом виде.</div>

    <div class="card" id="authCard">
      <h2>Вход</h2>
      <div class="row">
        <div><label>Логин</label><input id="loginUser" type="text" placeholder="founder"/></div>
        <div><label>Пароль</label><input id="loginPass" type="password" placeholder="********"/></div>
      </div>
      <div style="margin-top:10px;">
        <button class="btn" onclick="login()">Войти</button>
      </div>
      <div class="err" id="loginErr"></div>
    </div>

    <div id="mainApp" class="hidden">
      <div class="card">
        <h2>Обзор и отчеты</h2>
        <div class="row">
          <div><b>Период:</b> текущий месяц</div>
          <div><b>Клиентов:</b> <span id="kpiTenants">0</span></div>
          <div><b>Расход (RUB):</b> <span id="kpiCost">0</span></div>
          <div><b>Запросов:</b> <span id="kpiReq">0</span></div>
        </div>
        <div class="row" style="margin-top:8px;">
          <div>
            <label title="Поиск по коду клиента, имени или домену">Поиск клиента</label>
            <input id="fltQ" type="text" placeholder="например: acme или acme.nwlvl.ru"/>
          </div>
          <div>
            <label title="Фильтр по коду AI-модуля">Фильтр модуля</label>
            <input id="fltModule" type="text" placeholder="например: ai_research_engine"/>
          </div>
          <div>
            <label title="1 = включен, 0 = выключен">Статус модуля</label>
            <input id="fltEnabled" type="number" placeholder="1 или 0"/>
          </div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn" onclick="load()">Применить фильтры</button>
          <button class="btn" onclick="downloadCsv()">Скачать CSV</button>
          <button class="btn" onclick="logout()">Выйти</button>
        </div>
        <div id="msg" class="ok"></div>
        <div id="err" class="err"></div>
      </div>

      <div class="card">
        <h2>Провайдеры и токены</h2>
        <div class="hint">Шаг 1: введи код провайдера (например `gigachat`, `deepseek`, `qwen`) и его токен.</div>
        <div class="row" style="margin-top:8px;">
          <div>
            <label title="Короткий код, которым ты будешь оперировать в маршрутизации">Код провайдера</label>
            <input id="secretProvider" type="text" placeholder="например: deepseek"/>
          </div>
          <div>
            <label title="API токен провайдера. После сохранения не отображается.">Токен провайдера</label>
            <input id="secretToken" type="password" placeholder="вставь токен"/>
          </div>
          <div>
            <label title="Быстрая проверка: есть ли токен у выбранного провайдера">Проверка провайдера</label>
            <input id="testProvider" type="text" placeholder="например: deepseek"/>
          </div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn" onclick="saveProviderToken()">Сохранить токен</button>
          <button class="btn" onclick="testProviderConnection()">Проверить</button>
        </div>
        <div id="providerList" class="hint" style="margin-top:8px;"></div>
      </div>

      <div class="card">
        <h2>Маршрутизация задач AI</h2>
        <div class="hint">Шаг 2: для каждой задачи выбери провайдера и движок. Названия полей нейтральные и не привязаны к конкретной модели.</div>

        <div class="task">
          <h3>Анализ сделки</h3>
          <div class="row">
            <div><label title="Основной провайдер для задачи">Основной провайдер</label><input id="rtDealPrimaryProvider" type="text" placeholder="gigachat"/></div>
            <div><label title="Название модели/движка у провайдера">Основной движок</label><input id="rtDealPrimaryEngine" type="text" placeholder="lite"/></div>
            <div><label>Резервный провайдер</label><input id="rtDealFallbackProvider" type="text" placeholder="deepseek"/></div>
            <div><label>Резервный движок</label><input id="rtDealFallbackEngine" type="text" placeholder="v3"/></div>
          </div>
          <div class="row" style="margin-top:8px;">
            <div><label title="Если пусто, берется токен основного провайдера">Источник токена (опц.)</label><input id="rtDealTokenProvider" type="text" placeholder="оставь пустым или укажи код"/></div>
            <div><label>Лимит запросов/день</label><input id="rtDealMaxReq" type="number" placeholder="20"/></div>
            <div><label>Лимит выходных токенов</label><input id="rtDealMaxOut" type="number" placeholder="1200"/></div>
          </div>
        </div>

        <div class="task">
          <h3>Поддержка решения</h3>
          <div class="row">
            <div><label>Основной провайдер</label><input id="rtDecisionPrimaryProvider" type="text" placeholder="deepseek"/></div>
            <div><label>Основной движок</label><input id="rtDecisionPrimaryEngine" type="text" placeholder="v3"/></div>
            <div><label>Резервный провайдер</label><input id="rtDecisionFallbackProvider" type="text" placeholder="gigachat"/></div>
            <div><label>Резервный движок</label><input id="rtDecisionFallbackEngine" type="text" placeholder="pro"/></div>
          </div>
          <div class="row" style="margin-top:8px;">
            <div><label>Источник токена (опц.)</label><input id="rtDecisionTokenProvider" type="text" placeholder="оставь пустым или укажи код"/></div>
            <div><label>Лимит запросов/день</label><input id="rtDecisionMaxReq" type="number" placeholder="10"/></div>
            <div><label>Лимит выходных токенов</label><input id="rtDecisionMaxOut" type="number" placeholder="1800"/></div>
          </div>
        </div>

        <div class="task">
          <h3>Обогащение клиента</h3>
          <div class="row">
            <div><label>Основной провайдер</label><input id="rtEnrichPrimaryProvider" type="text" placeholder="gigachat"/></div>
            <div><label>Основной движок</label><input id="rtEnrichPrimaryEngine" type="text" placeholder="lite"/></div>
            <div><label>Резервный провайдер</label><input id="rtEnrichFallbackProvider" type="text" placeholder="qwen"/></div>
            <div><label>Резервный движок</label><input id="rtEnrichFallbackEngine" type="text" placeholder="instruct"/></div>
          </div>
          <div class="row" style="margin-top:8px;">
            <div><label>Источник токена (опц.)</label><input id="rtEnrichTokenProvider" type="text" placeholder="оставь пустым или укажи код"/></div>
            <div><label>Лимит запросов/день</label><input id="rtEnrichMaxReq" type="number" placeholder="50"/></div>
            <div><label>Лимит выходных токенов</label><input id="rtEnrichMaxOut" type="number" placeholder="800"/></div>
          </div>
        </div>

        <div class="task">
          <h3>Стратегия конкурентов</h3>
          <div class="row">
            <div><label>Основной провайдер</label><input id="rtStrategyPrimaryProvider" type="text" placeholder="gigachat"/></div>
            <div><label>Основной движок</label><input id="rtStrategyPrimaryEngine" type="text" placeholder="pro"/></div>
            <div><label>Резервный провайдер</label><input id="rtStrategyFallbackProvider" type="text" placeholder="qwen"/></div>
            <div><label>Резервный движок</label><input id="rtStrategyFallbackEngine" type="text" placeholder="max"/></div>
          </div>
          <div class="row" style="margin-top:8px;">
            <div><label>Источник токена (опц.)</label><input id="rtStrategyTokenProvider" type="text" placeholder="оставь пустым или укажи код"/></div>
            <div><label>Лимит запросов/день</label><input id="rtStrategyMaxReq" type="number" placeholder="5"/></div>
            <div><label>Лимит выходных токенов</label><input id="rtStrategyMaxOut" type="number" placeholder="2500"/></div>
          </div>
        </div>

        <div class="row" style="margin-top:10px;">
          <div>
            <label title="Используется для быстрой оценки расходов, если точных цен нет">Базовая цена за 1K токенов (RUB)</label>
            <input id="rtPricePer1k" type="number" placeholder="0.10"/>
          </div>
        </div>

        <div style="margin-top:10px;">
          <button class="btn" onclick="saveRouting()">Сохранить маршрутизацию</button>
        </div>
      </div>

      <div class="card">
        <h2>Клиенты и доступы модулей</h2>
        <table id="tbl">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Домен</th>
              <th>Расход (мес, RUB)</th>
              <th>Запросы</th>
              <th>Токены (in/out)</th>
              <th>Модули</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    async function getJson(url, opts={}) {
      const r = await fetch(url, opts);
      if (!r.ok) {
        let txt = await r.text();
        throw new Error(txt || ("HTTP " + r.status));
      }
      return r.json();
    }

    function moduleToggle(tenantCode, moduleCode, enabled) {
      return `<label style="display:block"><input type="checkbox" ${enabled ? "checked" : ""} onchange="toggleModule('${tenantCode}','${moduleCode}', this.checked)"> ${moduleCode}</label>`;
    }

    function api(path) { return "api/" + path; }
    function val(id) { return document.getElementById(id).value.trim(); }
    function setErr(text) { document.getElementById("err").textContent = text || ""; }
    function setMsg(text) { document.getElementById("msg").textContent = text || ""; }

    async function login() {
      document.getElementById("loginErr").textContent = "";
      try {
        await getJson(api("login"), {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({username: val("loginUser"), password: val("loginPass")})
        });
        document.getElementById("authCard").classList.add("hidden");
        document.getElementById("mainApp").classList.remove("hidden");
        await load();
      } catch (e) {
        document.getElementById("loginErr").textContent = "Ошибка входа: " + e.message;
      }
    }

    async function logout() {
      await getJson(api("logout"), { method: "POST" }).catch(() => {});
      location.reload();
    }

    async function load() {
      setErr(""); setMsg("");
      const params = new URLSearchParams();
      if (val("fltQ")) params.set("q", val("fltQ"));
      if (val("fltModule")) params.set("module", val("fltModule"));
      if (val("fltEnabled")) params.set("enabled", val("fltEnabled"));
      const data = await getJson(api("summary") + (params.toString() ? ("?" + params.toString()) : ""));
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
      document.getElementById("kpiTenants").textContent = String(data.meta.tenant_count || 0);
      document.getElementById("kpiCost").textContent = Number(data.meta.total_cost_rub || 0).toFixed(2);
      document.getElementById("kpiReq").textContent = String(data.meta.total_requests || 0);
      await loadSecretsMeta();
      await loadRouting();
    }

    async function toggleModule(tenant_code, module_code, enabled) {
      await getJson(api("module"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({tenant_code, module_code, enabled})
      });
      setMsg("Изменения по модулю сохранены");
    }

    async function loadSecretsMeta() {
      const data = await getJson(api("provider-secrets"));
      const providers = data.providers || [];
      if (!providers.length) {
        document.getElementById("providerList").textContent = "Сохраненных провайдеров пока нет.";
        return;
      }
      const labels = providers.map(p => `${p.provider}: ${p.has_key ? "токен сохранен" : "без токена"}`);
      document.getElementById("providerList").textContent = "Провайдеры: " + labels.join(" | ");
    }

    async function saveProviderToken() {
      const provider = val("secretProvider").toLowerCase();
      const token = val("secretToken");
      if (!provider || !token) {
        setErr("Укажи код провайдера и токен.");
        return;
      }
      await getJson(api("provider-secrets"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ provider, api_key: token })
      });
      document.getElementById("secretToken").value = "";
      setMsg("Токен сохранен на сервере");
      await loadSecretsMeta();
    }

    async function testProviderConnection() {
      const provider = val("testProvider");
      if (!provider) {
        setErr("Укажи провайдера: openai / anthropic / gemini");
        return;
      }
      setErr("");
      const res = await getJson(api("test-provider"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({provider})
      });
      setMsg("Проверка: " + (res.ok ? "OK" : "FAIL") + " (" + (res.provider || provider) + ")");
      if (!res.ok) setErr(res.error || "Ошибка проверки");
    }

    async function loadRouting() {
      const data = await getJson(api("routing"));
      const r = data.routing || {};
      const routes = r.routes || {};
      const budget = r.budget || {};

      const deal = routes.deal_analysis || {};
      const dec = routes.decision_support || {};
      const enr = routes.client_enrichment || {};
      const strat = routes.competitor_strategy || {};

      document.getElementById("rtDealPrimaryProvider").value = deal.primary_provider || "";
      document.getElementById("rtDealPrimaryEngine").value = deal.primary_engine || "";
      document.getElementById("rtDealFallbackProvider").value = deal.fallback_provider || "";
      document.getElementById("rtDealFallbackEngine").value = deal.fallback_engine || "";
      document.getElementById("rtDealTokenProvider").value = deal.token_provider || "";
      document.getElementById("rtDealMaxReq").value = deal.max_requests_per_day || "";
      document.getElementById("rtDealMaxOut").value = deal.max_output_tokens || "";

      document.getElementById("rtDecisionPrimaryProvider").value = dec.primary_provider || "";
      document.getElementById("rtDecisionPrimaryEngine").value = dec.primary_engine || "";
      document.getElementById("rtDecisionFallbackProvider").value = dec.fallback_provider || "";
      document.getElementById("rtDecisionFallbackEngine").value = dec.fallback_engine || "";
      document.getElementById("rtDecisionTokenProvider").value = dec.token_provider || "";
      document.getElementById("rtDecisionMaxReq").value = dec.max_requests_per_day || "";
      document.getElementById("rtDecisionMaxOut").value = dec.max_output_tokens || "";

      document.getElementById("rtEnrichPrimaryProvider").value = enr.primary_provider || "";
      document.getElementById("rtEnrichPrimaryEngine").value = enr.primary_engine || "";
      document.getElementById("rtEnrichFallbackProvider").value = enr.fallback_provider || "";
      document.getElementById("rtEnrichFallbackEngine").value = enr.fallback_engine || "";
      document.getElementById("rtEnrichTokenProvider").value = enr.token_provider || "";
      document.getElementById("rtEnrichMaxReq").value = enr.max_requests_per_day || "";
      document.getElementById("rtEnrichMaxOut").value = enr.max_output_tokens || "";

      document.getElementById("rtStrategyPrimaryProvider").value = strat.primary_provider || "";
      document.getElementById("rtStrategyPrimaryEngine").value = strat.primary_engine || "";
      document.getElementById("rtStrategyFallbackProvider").value = strat.fallback_provider || "";
      document.getElementById("rtStrategyFallbackEngine").value = strat.fallback_engine || "";
      document.getElementById("rtStrategyTokenProvider").value = strat.token_provider || "";
      document.getElementById("rtStrategyMaxReq").value = strat.max_requests_per_day || "";
      document.getElementById("rtStrategyMaxOut").value = strat.max_output_tokens || "";

      document.getElementById("rtPricePer1k").value = budget.default_price_rub_per_1k_tokens || "";
    }

    function buildRoute(primaryProviderId, primaryEngineId, fallbackProviderId, fallbackEngineId, tokenProviderId, maxReqId, maxOutId) {
      return {
        primary_provider: val(primaryProviderId).toLowerCase(),
        primary_engine: val(primaryEngineId),
        fallback_provider: val(fallbackProviderId).toLowerCase(),
        fallback_engine: val(fallbackEngineId),
        token_provider: val(tokenProviderId).toLowerCase(),
        max_requests_per_day: Number(val(maxReqId) || 0),
        max_output_tokens: Number(val(maxOutId) || 0),
      };
    }

    async function saveRouting() {
      const payload = {
        routes: {
          deal_analysis: buildRoute("rtDealPrimaryProvider", "rtDealPrimaryEngine", "rtDealFallbackProvider", "rtDealFallbackEngine", "rtDealTokenProvider", "rtDealMaxReq", "rtDealMaxOut"),
          decision_support: buildRoute("rtDecisionPrimaryProvider", "rtDecisionPrimaryEngine", "rtDecisionFallbackProvider", "rtDecisionFallbackEngine", "rtDecisionTokenProvider", "rtDecisionMaxReq", "rtDecisionMaxOut"),
          client_enrichment: buildRoute("rtEnrichPrimaryProvider", "rtEnrichPrimaryEngine", "rtEnrichFallbackProvider", "rtEnrichFallbackEngine", "rtEnrichTokenProvider", "rtEnrichMaxReq", "rtEnrichMaxOut"),
          competitor_strategy: buildRoute("rtStrategyPrimaryProvider", "rtStrategyPrimaryEngine", "rtStrategyFallbackProvider", "rtStrategyFallbackEngine", "rtStrategyTokenProvider", "rtStrategyMaxReq", "rtStrategyMaxOut"),
        },
        budget: {
          default_price_rub_per_1k_tokens: Number(val("rtPricePer1k") || 0),
        },
      };
      await getJson(api("routing"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      setMsg("Матрица маршрутизации сохранена");
    }

    async function downloadCsv() {
      const params = new URLSearchParams();
      if (val("fltQ")) params.set("q", val("fltQ"));
      if (val("fltModule")) params.set("module", val("fltModule"));
      if (val("fltEnabled")) params.set("enabled", val("fltEnabled"));
      const url = api("export.csv") + (params.toString() ? ("?" + params.toString()) : "");
      window.open(url, "_blank");
    }

    // Try silent session restore
    (async () => {
      try {
        await getJson(api("summary"));
        document.getElementById("authCard").classList.add("hidden");
        document.getElementById("mainApp").classList.remove("hidden");
        await load();
      } catch {
        // stay on login form
      }
    })();
  </script>
</body>
</html>
"""


def _now_utc():
    return datetime.utcnow()


def _clean_sessions():
    now = _now_utc()
    expired = [k for k, v in SESSIONS.items() if v["expires_at"] < now]
    for k in expired:
        del SESSIONS[k]


def _parse_cookies(raw):
    out = {}
    if not raw:
        return out
    parts = raw.split(";")
    for part in parts:
        if "=" in part:
            k, v = part.strip().split("=", 1)
            out[k] = v
    return out


def _load_provider_secrets():
    if not os.path.exists(SECRETS_FILE):
        return {"providers": {}}
    with open(SECRETS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"providers": {}}

    if isinstance(data.get("providers"), dict):
        normalized = {}
        for k, v in data["providers"].items():
            key = str(k).strip().lower()
            if isinstance(v, dict):
                api_key = str(v.get("api_key", "")).strip()
                base_url = str(v.get("base_url", "")).strip()
                if key and api_key:
                    normalized[key] = {"api_key": api_key, "base_url": base_url}
            else:
                val = str(v).strip()
                if key and val:
                    normalized[key] = {"api_key": val, "base_url": ""}
        return {"providers": normalized}

    # Backward compatibility: old flat format OPENAI_API_KEY...
    providers = {}
    for k, v in data.items():
        key = str(k).strip()
        val = str(v).strip()
        if not key or not val:
            continue
        if key.endswith("_API_KEY"):
            providers[key[:-8].lower()] = {"api_key": val, "base_url": ""}
    return {"providers": providers}


def _save_provider_secrets(new_data):
    secrets_data = _load_provider_secrets()
    providers = secrets_data.setdefault("providers", {})

    # New format: {provider, api_key}
    provider = str(new_data.get("provider", "")).strip().lower() if isinstance(new_data, dict) else ""
    api_key = str(new_data.get("api_key", "")).strip() if isinstance(new_data, dict) else ""
    base_url = str(new_data.get("base_url", "")).strip() if isinstance(new_data, dict) else ""
    if provider and api_key:
        providers[provider] = {"api_key": api_key, "base_url": base_url}

    # Backward compatibility: old flat payload
    if isinstance(new_data, dict):
        for k, v in new_data.items():
            key = str(k).strip()
            val = str(v).strip()
            if not key or not val:
                continue
            if key.endswith("_API_KEY"):
                providers[key[:-8].lower()] = {"api_key": val, "base_url": ""}

    tmp = SECRETS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(secrets_data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, SECRETS_FILE)
    try:
        os.chmod(SECRETS_FILE, 0o600)
    except Exception:
        pass
    return secrets_data


def _provider_env_name(provider):
    p = str(provider).strip().lower()
    return f"{p.upper()}_API_KEY" if p else ""


def provider_secrets_meta():
    data = _load_provider_secrets()
    providers = data.get("providers", {})
    all_codes = set(providers.keys())
    for env_key in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        if os.getenv(env_key):
            all_codes.add(env_key[:-8].lower())

    result = []
    for code in sorted(all_codes):
        obj = providers.get(code, {})
        if isinstance(obj, dict):
            key_val = str(obj.get("api_key", "")).strip()
            base_url = str(obj.get("base_url", "")).strip()
        else:
            key_val = str(obj).strip()
            base_url = ""
        has_key = bool(key_val or os.getenv(_provider_env_name(code)))
        result.append({"provider": code, "has_key": has_key})
    return {"providers": result}


def _provider_defaults(provider):
    p = str(provider).strip().lower()
    defaults = {
        "deepseek": "https://api.deepseek.com/v1",
        "qwen": "https://api.aitunnel.ru/v1",
        "openai": "https://api.openai.com/v1",
        "anthropic": "",
        "gemini": "",
        "gigachat": "",
    }
    return defaults.get(p, "")


def _provider_creds(provider):
    provider = str(provider).strip().lower()
    data = _load_provider_secrets()
    raw = data.get("providers", {}).get(provider, {})
    if isinstance(raw, dict):
        api_key = str(raw.get("api_key", "")).strip()
        base_url = str(raw.get("base_url", "")).strip() or _provider_defaults(provider)
    else:
        api_key = str(raw).strip()
        base_url = _provider_defaults(provider)
    if not api_key:
        api_key = os.getenv(_provider_env_name(provider), "")
    return {"provider": provider, "api_key": api_key, "base_url": base_url}


def test_provider(payload):
    provider = str(payload.get("provider", "")).strip().lower()
    if not provider:
        return {"ok": False, "provider": provider, "error": "unsupported provider"}

    creds = _provider_creds(provider)
    if not creds.get("api_key"):
        return {"ok": False, "provider": provider, "error": f"token for '{provider}' is not configured"}

    return {"ok": True, "provider": provider}


def _http_json(method, url, payload=None, headers=None, timeout=40):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = Request(url=url, data=body, headers=req_headers, method=method)
    with urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8")
        if not raw:
            return {}
        return json.loads(raw)


def _allowed_origins():
    return [x.strip() for x in PUBLIC_AI_ALLOWED_ORIGINS.split(",") if x.strip()]


def _origin_allowed(origin):
    if not origin:
        return False
    return origin in _allowed_origins()


def _validate_tenant_pb_url(tenant_pb_url):
    try:
        u = urlparse(tenant_pb_url)
    except Exception:
        return False
    if u.scheme != "https":
        return False
    host = (u.hostname or "").lower()
    if not host:
        return False
    if host == "pb.nwlvl.ru":
        return True
    if host.endswith(".nwlvl.ru"):
        return True
    return False


def _verify_tenant_user(tenant_pb_url, user_token):
    base = tenant_pb_url.rstrip("/")
    req = Request(
        url=f"{base}/collections/users/auth-refresh",
        data=b"{}",
        headers={"Content-Type": "application/json", "Authorization": user_token},
        method="POST",
    )
    with urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8")
    data = json.loads(raw) if raw else {}
    rec = data.get("record", {}) if isinstance(data, dict) else {}
    uid = str(rec.get("id", "")).strip()
    if not uid:
        raise RuntimeError("invalid tenant user token")
    return {"id": uid, "email": rec.get("email", "")}


def _check_rate_limit(user_id):
    now = datetime.utcnow()
    slot = PUBLIC_AI_RATE_LIMIT.setdefault(user_id, [])
    threshold = now - timedelta(minutes=1)
    slot[:] = [x for x in slot if x > threshold]
    if len(slot) >= 20:
        return False
    slot.append(now)
    return True


def _extract_json_object(text):
    text = (text or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return {}
    return {}


def _run_openai_compatible(provider, engine, prompt):
    creds = _provider_creds(provider)
    api_key = creds.get("api_key", "")
    base_url = creds.get("base_url", "").rstrip("/")
    if not api_key:
        return {"ok": False, "error": f"token for provider '{provider}' is missing"}
    if not base_url:
        return {"ok": False, "error": f"base_url for provider '{provider}' is not configured"}

    url = f"{base_url}/chat/completions"
    payload = {
        "model": engine,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты AI-помощник отдела продаж. Отвечай строго JSON объектом: "
                    '{"score": number 0..100, "summary": string, "suggestions": string, "risks": string}.'
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    try:
        res = _http_json("POST", url, payload, headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
        choices = res.get("choices", []) if isinstance(res, dict) else []
        content = ""
        if choices and isinstance(choices[0], dict):
            content = str(((choices[0].get("message") or {}).get("content")) or "")
        parsed = _extract_json_object(content)
        usage = res.get("usage", {}) if isinstance(res, dict) else {}
        return {"ok": True, "parsed": parsed, "usage": usage}
    except HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        return {"ok": False, "error": f"http {e.code}: {err_body}"}
    except URLError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _auth_tenant_admin(pb_url):
    base = pb_url.rstrip("/")
    res = _http_json(
        "POST",
        f"{base}/admins/auth-with-password",
        {"identity": TENANT_PB_ADMIN_EMAIL, "password": TENANT_PB_ADMIN_PASSWORD},
        timeout=30,
    )
    token = str(res.get("token", "")).strip() if isinstance(res, dict) else ""
    if not token:
        raise RuntimeError("tenant admin auth failed")
    return token


def _tenant_api_create(pb_url, collection, data, admin_token):
    base = pb_url.rstrip("/")
    return _http_json(
        "POST",
        f"{base}/collections/{collection}/records",
        data,
        headers={"Authorization": admin_token},
        timeout=30,
    )


def _tenant_api_update(pb_url, collection, record_id, data, admin_token):
    base = pb_url.rstrip("/")
    return _http_json(
        "PATCH",
        f"{base}/collections/{collection}/records/{record_id}",
        data,
        headers={"Authorization": admin_token},
        timeout=30,
    )


def run_ai_deal_analysis(payload):
    deal_id = str(payload.get("deal_id", "")).strip()
    tenant_pb_url = str(payload.get("tenant_pb_url", "")).strip().rstrip("/")
    task_code = str(payload.get("task_code", "deal_analysis")).strip() or "deal_analysis"
    user_id = str(payload.get("user_id", "")).strip()
    tenant_user_token = str(payload.get("tenant_user_token", "")).strip()
    context = payload.get("context", {}) if isinstance(payload.get("context"), dict) else {}
    if not deal_id or not tenant_pb_url:
        return {"ok": False, "error": "deal_id and tenant_pb_url are required"}
    if not _validate_tenant_pb_url(tenant_pb_url):
        return {"ok": False, "error": "tenant_pb_url is not allowed"}
    if not tenant_user_token:
        return {"ok": False, "error": "tenant user token is required"}

    try:
        tenant_user = _verify_tenant_user(tenant_pb_url, tenant_user_token)
    except Exception as e:
        return {"ok": False, "error": f"unauthorized tenant user: {e}"}
    if not _check_rate_limit(str(tenant_user.get("id", ""))):
        return {"ok": False, "error": "rate limit exceeded: max 20 requests/min per user"}
    if not user_id:
        user_id = str(tenant_user.get("id", ""))

    routing = get_routing_matrix()
    route = (routing.get("routes", {}) or {}).get(task_code, {})
    primary_provider = str(route.get("primary_provider", "")).strip().lower()
    primary_engine = str(route.get("primary_engine", "")).strip()
    fallback_provider = str(route.get("fallback_provider", "")).strip().lower()
    fallback_engine = str(route.get("fallback_engine", "")).strip()

    if not primary_provider or not primary_engine:
        return {"ok": False, "error": f"routing for '{task_code}' is not configured"}

    prompt = (
        "Проанализируй сделку и дай оценку риска/шансов.\n"
        f"Контекст сделки (JSON): {json.dumps(context, ensure_ascii=False)}\n"
        "Верни JSON без markdown."
    )

    llm_result = _run_openai_compatible(primary_provider, primary_engine, prompt)
    used_provider = primary_provider
    used_engine = primary_engine
    if not llm_result.get("ok") and fallback_provider and fallback_engine:
        llm_result = _run_openai_compatible(fallback_provider, fallback_engine, prompt)
        used_provider = fallback_provider
        used_engine = fallback_engine
    if not llm_result.get("ok"):
        return {"ok": False, "error": llm_result.get("error", "llm request failed")}

    parsed = llm_result.get("parsed", {}) if isinstance(llm_result.get("parsed"), dict) else {}
    usage = llm_result.get("usage", {}) if isinstance(llm_result.get("usage"), dict) else {}
    score = parsed.get("score", 0)
    try:
        score = max(0, min(100, int(float(score))))
    except Exception:
        score = 0
    summary = str(parsed.get("summary", "")).strip()
    suggestions = str(parsed.get("suggestions", "")).strip()
    risks_text = str(parsed.get("risks", "")).strip()
    total_tokens = usage.get("total_tokens", 0) if isinstance(usage, dict) else 0
    try:
        total_tokens = float(total_tokens or 0)
    except Exception:
        total_tokens = 0

    admin_token = _auth_tenant_admin(tenant_pb_url)
    ai_record = _tenant_api_create(
        tenant_pb_url,
        "ai_insights",
        {
            "deal_id": deal_id,
            "score": score,
            "summary": summary,
            "suggestions": suggestions,
            "risks": risks_text,
            "model": f"{used_provider}:{used_engine}",
            "token_usage": total_tokens,
            "created_by": user_id or None,
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
        admin_token,
    )

    timeline_text = f"AI-анализ обновлен. Score: {score}/100.\nРезюме: {summary}\nРекомендации: {suggestions}"
    _tenant_api_create(
        tenant_pb_url,
        "timeline",
        {
            "deal_id": deal_id,
            "user_id": user_id or None,
            "action": "ai_analysis",
            "comment": timeline_text,
            "payload": {"provider": used_provider, "engine": used_engine, "insight_id": ai_record.get("id", "")},
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        admin_token,
    )
    _tenant_api_update(
        tenant_pb_url,
        "deals",
        deal_id,
        {"current_score": score, "current_recommendations": suggestions},
        admin_token,
    )
    return {
        "ok": True,
        "score": score,
        "summary": summary,
        "suggestions": suggestions,
        "provider": used_provider,
        "engine": used_engine,
    }


def default_routing_matrix():
    return {
        "routes": {
            "deal_analysis": {
                "primary_provider": "gigachat",
                "primary_engine": "lite",
                "fallback_provider": "deepseek",
                "fallback_engine": "v3",
                "token_provider": "",
                "max_requests_per_day": 20,
                "max_output_tokens": 1200,
            },
            "decision_support": {
                "primary_provider": "deepseek",
                "primary_engine": "v3",
                "fallback_provider": "gigachat",
                "fallback_engine": "pro",
                "token_provider": "",
                "max_requests_per_day": 10,
                "max_output_tokens": 1800,
            },
            "client_enrichment": {
                "primary_provider": "gigachat",
                "primary_engine": "lite",
                "fallback_provider": "qwen",
                "fallback_engine": "instruct",
                "token_provider": "",
                "max_requests_per_day": 50,
                "max_output_tokens": 800,
            },
            "competitor_strategy": {
                "primary_provider": "gigachat",
                "primary_engine": "pro",
                "fallback_provider": "qwen",
                "fallback_engine": "max",
                "token_provider": "",
                "max_requests_per_day": 5,
                "max_output_tokens": 2500,
            },
        },
        "budget": {
            "default_price_rub_per_1k_tokens": 0.1,
        },
    }


def _normalize_route_entry(route):
    route = route if isinstance(route, dict) else {}
    out = {}
    out["primary_provider"] = str(route.get("primary_provider", "")).strip().lower()
    out["primary_engine"] = str(route.get("primary_engine", "")).strip()
    out["fallback_provider"] = str(route.get("fallback_provider", "")).strip().lower()
    out["fallback_engine"] = str(route.get("fallback_engine", "")).strip()
    out["token_provider"] = str(route.get("token_provider", "")).strip().lower()

    # Backward compatibility for old keys
    old_primary = str(route.get("primary_model", "")).strip()
    old_fallback = str(route.get("fallback_model", "")).strip()
    if old_primary and not out["primary_engine"]:
        out["primary_engine"] = old_primary
    if old_fallback and not out["fallback_engine"]:
        out["fallback_engine"] = old_fallback

    def _split_provider_engine(raw):
        low = raw.lower()
        for provider in ("gigachat", "deepseek", "qwen", "openai", "anthropic", "gemini"):
            if low.startswith(provider):
                engine = raw[len(provider):].lstrip("-_ ")
                return provider, (engine or raw)
        return "", raw

    if out["primary_engine"] and not out["primary_provider"]:
        p, e = _split_provider_engine(out["primary_engine"])
        if p:
            out["primary_provider"] = p
            out["primary_engine"] = e
    if out["fallback_engine"] and not out["fallback_provider"]:
        p, e = _split_provider_engine(out["fallback_engine"])
        if p:
            out["fallback_provider"] = p
            out["fallback_engine"] = e

    out["max_requests_per_day"] = int(route.get("max_requests_per_day", 0) or 0)
    out["max_output_tokens"] = int(route.get("max_output_tokens", 0) or 0)
    return out


def _normalize_routing_matrix(data):
    default = default_routing_matrix()
    if not isinstance(data, dict):
        return default

    routes = data.get("routes", {})
    budget = data.get("budget", {})
    out = {"routes": {}, "budget": {}}
    for route_key, default_entry in default["routes"].items():
        route_raw = routes.get(route_key, {}) if isinstance(routes, dict) else {}
        merged = dict(default_entry)
        merged.update(_normalize_route_entry(route_raw))
        out["routes"][route_key] = merged

    out["budget"]["default_price_rub_per_1k_tokens"] = float(
        budget.get("default_price_rub_per_1k_tokens", default["budget"]["default_price_rub_per_1k_tokens"]) or 0
    )
    return out


def get_routing_matrix():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT value FROM system_settings WHERE key=?", ("ai.routing.matrix",))
    row = cur.fetchone()
    con.close()
    if not row or not row[0]:
        return default_routing_matrix()
    try:
        data = json.loads(str(row[0]))
        if isinstance(data, dict):
            return _normalize_routing_matrix(data)
    except Exception:
        pass
    return default_routing_matrix()


def save_routing_matrix(payload):
    normalized = _normalize_routing_matrix(payload)
    value = json.dumps(normalized, ensure_ascii=False)
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT id FROM system_settings WHERE key=?", ("ai.routing.matrix",))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE system_settings SET value=?, updated=? WHERE key=?", (value, ts, "ai.routing.matrix"))
    else:
        rid = "r" + secrets.token_hex(7)
        cur.execute(
            """
            INSERT INTO system_settings (id, key, value, description, group_name, is_public, created, updated)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (rid, "ai.routing.matrix", value, "AI routing matrix by task", "ai", 0, ts, ts),
        )
    con.commit()
    con.close()
    return {"ok": True}


def fetch_summary(filters):
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
        WHERE (t.status='active' OR t.is_active=1)
        ORDER BY month_cost_rub DESC, t.code ASC
        """
    )
    tenants = [dict(r) for r in cur.fetchall()]

    q = (filters.get("q") or "").strip().lower()
    module_filter = (filters.get("module") or "").strip().lower()
    enabled_filter = (filters.get("enabled") or "").strip()

    for tenant in tenants:
        cur.execute(
            "SELECT module_code, enabled, override_limit_value FROM tenant_modules WHERE tenant_code=? ORDER BY module_code",
            (tenant["code"],),
        )
        tenant["modules"] = [dict(r) for r in cur.fetchall()]

    def _tenant_match(t):
        if q:
            hay = " ".join(
                [
                    str(t.get("code", "")),
                    str(t.get("name", "")),
                    str(t.get("primary_domain", "")),
                ]
            ).lower()
            if q not in hay:
                return False
        if module_filter:
            mods = t.get("modules", [])
            mm = [m for m in mods if str(m.get("module_code", "")).lower() == module_filter]
            if not mm:
                return False
            if enabled_filter in ("0", "1"):
                if int(mm[0].get("enabled", 0)) != int(enabled_filter):
                    return False
        return True

    tenants = [t for t in tenants if _tenant_match(t)]

    cur.execute("SELECT key, value FROM system_settings WHERE group_name='ai'")
    settings = {r["key"]: r["value"] for r in cur.fetchall()}
    con.close()
    meta = {
        "tenant_count": len(tenants),
        "total_cost_rub": float(sum(float(t.get("month_cost_rub") or 0) for t in tenants)),
        "total_requests": int(sum(int(t.get("request_count") or 0) for t in tenants)),
    }
    return {"tenants": tenants, "settings": settings, "meta": meta}


def update_module(payload):
    tenant_code = str(payload.get("tenant_code", "")).strip()
    module_code = str(payload.get("module_code", "")).strip()
    enabled = 1 if bool(payload.get("enabled")) else 0
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")

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
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
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
    def _send(self, status=200, body="", content_type="text/plain; charset=utf-8", headers=None):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if headers:
            for k, v in headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status, obj):
        self._send(status, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def _is_public_api_path(self, path):
        return path.startswith("/api/public/")

    def _public_headers(self, origin=None):
        allow_origin = origin if origin and _origin_allowed(origin) else "null"
        return {
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Vary": "Origin",
        }

    def _json_headers(self, extra=None):
        h = {"Cache-Control": "no-store"}
        if extra:
            h.update(extra)
        return h

    def _require_auth(self):
        _clean_sessions()
        cookies = _parse_cookies(self.headers.get("Cookie"))
        token = cookies.get("fc_session")
        if not token:
            return False
        sess = SESSIONS.get(token)
        if not sess:
            return False
        if sess["expires_at"] < _now_utc():
            del SESSIONS[token]
            return False
        return True

    def _read_json(self):
        n = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(n).decode("utf-8") if n > 0 else "{}"
        return json.loads(raw or "{}")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/" or path == "/index.html":
            self._send(200, INDEX_HTML, "text/html; charset=utf-8")
            return
        if path == "/api/summary":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                qs = parse_qs(parsed.query)
                filters = {k: (v[0] if v else "") for k, v in qs.items()}
                self._json(200, fetch_summary(filters))
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/export.csv":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                qs = parse_qs(parsed.query)
                filters = {k: (v[0] if v else "") for k, v in qs.items()}
                data = fetch_summary(filters)
                out = io.StringIO()
                w = csv.writer(out)
                w.writerow(["tenant_code", "tenant_name", "domain", "month_cost_rub", "request_count", "input_tokens", "output_tokens"])
                for t in data["tenants"]:
                    w.writerow(
                        [
                            t.get("code", ""),
                            t.get("name", ""),
                            t.get("primary_domain", ""),
                            t.get("month_cost_rub", 0),
                            t.get("request_count", 0),
                            t.get("input_tokens", 0),
                            t.get("output_tokens", 0),
                        ]
                    )
                self._send(
                    200,
                    out.getvalue(),
                    "text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=founder_ai_report.csv"},
                )
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/provider-secrets":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                self._json(200, provider_secrets_meta())
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/routing":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                self._json(200, {"routing": get_routing_matrix()})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/public/health":
            self._send(200, json.dumps({"ok": True}), "application/json; charset=utf-8", headers=self._public_headers())
            return
        self._send(404, "not found")

    def do_OPTIONS(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if self._is_public_api_path(path):
            origin = self.headers.get("Origin", "")
            if not _origin_allowed(origin):
                self._send(403, "forbidden origin")
                return
            self._send(204, "", "text/plain; charset=utf-8", headers=self._public_headers(origin))
            return
        self._send(404, "not found")

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._read_json()
        except Exception:
            self._json(400, {"error": "invalid json"})
            return
        try:
            if path == "/api/login":
                username = str(payload.get("username", "")).strip()
                password = str(payload.get("password", ""))
                if username != OWNER_USER or password != OWNER_PASSWORD:
                    self._json(401, {"error": "invalid credentials"})
                    return
                token = secrets.token_urlsafe(32)
                SESSIONS[token] = {"user": OWNER_USER, "expires_at": _now_utc() + timedelta(hours=SESSION_TTL_HOURS)}
                # return JSON and set secure session cookie
                body = json.dumps({"ok": True}, ensure_ascii=False)
                self._send(
                    200,
                    body,
                    "application/json; charset=utf-8",
                    headers={
                        "Set-Cookie": f"fc_session={token}; Path=/owner/; HttpOnly; SameSite=Lax; Max-Age={SESSION_TTL_HOURS*3600}",
                        "Cache-Control": "no-store",
                    },
                )
                return
            if path == "/api/logout":
                cookies = _parse_cookies(self.headers.get("Cookie"))
                token = cookies.get("fc_session")
                if token and token in SESSIONS:
                    del SESSIONS[token]
                self._send(
                    200,
                    json.dumps({"ok": True}, ensure_ascii=False),
                    "application/json; charset=utf-8",
                    headers={"Set-Cookie": "fc_session=; Path=/owner/; HttpOnly; SameSite=Lax; Max-Age=0"},
                )
                return
            if path == "/api/public/ai/analyze-deal":
                origin = self.headers.get("Origin", "")
                if not _origin_allowed(origin):
                    self._send(403, json.dumps({"ok": False, "error": "forbidden origin"}), "application/json; charset=utf-8")
                    return
                payload["tenant_user_token"] = self.headers.get("Authorization", "")
                result = run_ai_deal_analysis(payload)
                self._send(
                    200 if result.get("ok") else 400,
                    json.dumps(result, ensure_ascii=False),
                    "application/json; charset=utf-8",
                    headers=self._public_headers(origin),
                )
                return
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            if path == "/api/module":
                self._json(200, update_module(payload))
                return
            if path == "/api/settings":
                self._json(200, update_settings(payload))
                return
            if path == "/api/provider-secrets":
                saved = _save_provider_secrets(payload)
                self._json(200, {"ok": True, "providers": sorted(saved.get("providers", {}).keys())})
                return
            if path == "/api/test-provider":
                self._json(200, test_provider(payload))
                return
            if path == "/api/routing":
                self._json(200, save_routing_matrix(payload))
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

