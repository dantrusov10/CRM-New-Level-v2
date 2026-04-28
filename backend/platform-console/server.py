#!/usr/bin/env python3
import csv
import io
import json
import os
import secrets
import sqlite3
import ssl
import uuid
import re
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import parse_qs, urlparse, urlencode

DB_PATH = os.getenv("CONTROL_DB_PATH", "/opt/pb-control/pb_data/data.db")
HOST = os.getenv("PLATFORM_CONSOLE_HOST", "127.0.0.1")
PORT = int(os.getenv("PLATFORM_CONSOLE_PORT", "8181"))
OWNER_USER = os.getenv("PLATFORM_CONSOLE_USER", "founder")
OWNER_PASSWORD = os.getenv("PLATFORM_CONSOLE_PASSWORD", "")
SESSION_TTL_HOURS = int(os.getenv("PLATFORM_CONSOLE_SESSION_TTL_HOURS", "24"))
SECRETS_FILE = os.getenv("PLATFORM_AI_SECRETS_FILE", "/opt/pb-control/.ai-provider-secrets.json")
TENANT_PB_ADMIN_EMAIL = os.getenv("TENANT_PB_ADMIN_EMAIL", "")
TENANT_PB_ADMIN_PASSWORD = os.getenv("TENANT_PB_ADMIN_PASSWORD", "")
PUBLIC_AI_ALLOWED_ORIGINS = os.getenv(
    "PUBLIC_AI_ALLOWED_ORIGINS", "https://app.nwlvl.ru,https://nwlvl.ru,http://localhost:5173"
)
GIGACHAT_INSECURE_TLS = os.getenv("GIGACHAT_INSECURE_TLS", "0")
AI_GATEWAY_AUDIT_LOG = os.getenv("AI_GATEWAY_AUDIT_LOG", "/opt/pb-control/ai-gateway-audit.jsonl")

SESSIONS = {}
PUBLIC_AI_RATE_LIMIT = {}
AI_QUALITY_GATE_WINDOW = {}
LOGIN_RATE_LIMIT = {}

MASTER_PROMPT_KEY_DEAL_ANALYSIS = "ai.master_prompt.deal_analysis"
MASTER_PROMPT_KEY_CLIENT_RESEARCH = "ai.master_prompt.client_research"
MASTER_PROMPT_KEY_TZ_ANALYSIS = "ai.master_prompt.tz_analysis"
MASTER_PROMPT_KEY_SEMANTIC_ENRICHMENT = "ai.master_prompt.semantic_enrichment"
AI_DATA_POLICY_KEY = "ai.data_policy.v1"
AI_CLIENT_RESEARCH_COOLDOWN_KEY = "ai.cooldown.client_research.v1"
AI_DECISION_SUPPORT_LIMIT_KEY = "ai.limit.decision_support.v1"
AI_TENANT_LIMITS_KEY = "ai.tenant.limits.v1"


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
    input[type="text"], input[type="number"], input[type="password"], textarea { width: 100%; border: 1px solid #c7cfdb; border-radius: 8px; padding: 7px; }
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
            <input id="secretProvider" type="text" placeholder="например: gigachat / deepseek / qwen"/>
          </div>
          <div>
            <label title="API токен провайдера. После сохранения не отображается.">Токен провайдера</label>
            <input id="secretToken" type="password" placeholder="для gigachat: Authorization Key из ЛК"/>
          </div>
          <div>
            <label title="Базовый URL API провайдера (для OpenRouter: https://openrouter.ai/api/v1)">Base URL (опц.)</label>
            <input id="secretBaseUrl" type="text" placeholder="например: https://openrouter.ai/api/v1"/>
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
        <div class="hint">Шаг 2: для каждого AI-сценария выбери провайдера и движок. Названия сценариев соответствуют CRM.</div>

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
          <h3>Поддержка решения (оперативные рекомендации, НЕ анализ ТЗ)</h3>
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
          <h3>Исследование клиента</h3>
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
          <h3>Общая семантика / парсеры</h3>
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

        <div class="task">
          <h3>Анализ ТЗ</h3>
          <div class="row">
            <div><label>Основной провайдер</label><input id="rtTzPrimaryProvider" type="text" placeholder="deepseek"/></div>
            <div><label>Основной движок</label><input id="rtTzPrimaryEngine" type="text" placeholder="v3"/></div>
            <div><label>Резервный провайдер</label><input id="rtTzFallbackProvider" type="text" placeholder="qwen"/></div>
            <div><label>Резервный движок</label><input id="rtTzFallbackEngine" type="text" placeholder="qwen3.6-plus"/></div>
          </div>
          <div class="row" style="margin-top:8px;">
            <div><label>Источник токена (опц.)</label><input id="rtTzTokenProvider" type="text" placeholder="оставь пустым или укажи код"/></div>
            <div><label>Лимит запросов/день</label><input id="rtTzMaxReq" type="number" placeholder="20"/></div>
            <div><label>Лимит выходных токенов</label><input id="rtTzMaxOut" type="number" placeholder="2800"/></div>
          </div>
        </div>

        <div class="row" style="margin-top:10px;">
          <div>
            <label title="Используется для быстрой оценки расходов, если точных цен нет">Базовая цена за 1K токенов (RUB)</label>
            <input id="rtPricePer1k" type="number" placeholder="0.10"/>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div style="min-width:100%;">
            <label title="Общий шаблон запроса для анализа сделки. Можно менять без релиза кода.">Промпт AI для анализа сделки</label>
            <textarea id="rtPromptDeal" rows="5" placeholder="Инструкция модели для анализа сделки..."></textarea>
            <div class="hint">В запрос также автоматически добавляются: все поля сделки, комментарии/заметки/события timeline, последние AI-результаты.</div>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div style="min-width:100%;">
            <label title="Founder-only. Не виден клиентам. Главный промпт-модератор конкретности и формата для анализа сделки.">Master Prompt: Анализ сделки (только founder)</label>
            <textarea id="rtMasterPromptDeal" rows="6" placeholder="Системные правила конкретности и anti-water для всех клиентов..."></textarea>
            <div class="hint">Этот промпт применяется поверх tenant-промпта и хранится только в control DB.</div>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div style="min-width:100%;">
            <label title="Founder-only. Базовый родительский промпт для исследования клиента.">Master Prompt: Исследование клиента</label>
            <textarea id="rtMasterPromptClient" rows="4" placeholder="Системные правила для client_research..."></textarea>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div style="min-width:100%;">
            <label title="Founder-only. Базовый родительский промпт для анализа ТЗ.">Master Prompt: Анализ ТЗ</label>
            <textarea id="rtMasterPromptTz" rows="4" placeholder="Системные правила для tender_tz_analysis..."></textarea>
          </div>
        </div>
        <div class="row" style="margin-top:10px;">
          <div style="min-width:100%;">
            <label title="Founder-only. Базовый родительский промпт для обогащения семантики.">Master Prompt: Обогащение семантики</label>
            <textarea id="rtMasterPromptSemantic" rows="4" placeholder="Системные правила для semantic_enrichment..."></textarea>
          </div>
        </div>

        <div style="margin-top:10px;">
          <button class="btn" onclick="saveRouting()">Сохранить маршрутизацию</button>
        </div>
        <div id="routingMsg" class="ok"></div>
      </div>

      <div class="card">
        <h2>Клиенты и доступы модулей</h2>
        <div class="hint" style="margin-bottom:10px;">Гибкие лимиты AI по каждому клиенту (tenant).</div>
        <div class="row" style="margin-bottom:10px;">
          <div>
            <label>Tenant code</label>
            <input id="limitTenantCode" type="text" placeholder="например: nwlvl_prod"/>
          </div>
          <div>
            <label>Поддержка решения: лимит/месяц на 1 сделку</label>
            <input id="limitDecisionMonthly" type="number" placeholder="10"/>
          </div>
          <div>
            <label>Исследование клиента: cooldown (дней)</label>
            <input id="limitClientCooldownDays" type="number" placeholder="180"/>
          </div>
          <div>
            <label>&nbsp;</label>
            <div style="display:flex;gap:8px;">
              <button class="btn" onclick="loadTenantLimits()">Загрузить лимиты</button>
              <button class="btn" onclick="saveTenantLimits()">Сохранить лимиты</button>
            </div>
          </div>
        </div>
        <div id="tenantLimitsMsg" class="ok"></div>
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
      const baseUrl = val("secretBaseUrl");
      if (!provider || !token) {
        setErr("Укажи код провайдера и токен.");
        return;
      }
      await getJson(api("provider-secrets"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ provider, api_key: token, base_url: baseUrl })
      });
      document.getElementById("secretToken").value = "";
      document.getElementById("secretBaseUrl").value = "";
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
      const prompts = r.prompts || {};

      const deal = routes.deal_analysis || {};
      const dec = routes.decision_support || {};
      const enr = routes.client_enrichment || {};
      const strat = routes.competitor_strategy || {};
      const tz = routes.tender_tz_analysis || {};

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

      document.getElementById("rtTzPrimaryProvider").value = tz.primary_provider || "";
      document.getElementById("rtTzPrimaryEngine").value = tz.primary_engine || "";
      document.getElementById("rtTzFallbackProvider").value = tz.fallback_provider || "";
      document.getElementById("rtTzFallbackEngine").value = tz.fallback_engine || "";
      document.getElementById("rtTzTokenProvider").value = tz.token_provider || "";
      document.getElementById("rtTzMaxReq").value = tz.max_requests_per_day || "";
      document.getElementById("rtTzMaxOut").value = tz.max_output_tokens || "";

      document.getElementById("rtPricePer1k").value = budget.default_price_rub_per_1k_tokens || "";
      document.getElementById("rtPromptDeal").value = prompts.deal_analysis || "";
      const mp = await getJson(api("master-prompt"));
      document.getElementById("rtMasterPromptDeal").value = (mp.master_prompts?.deal_analysis || "");
      document.getElementById("rtMasterPromptClient").value = (mp.master_prompts?.client_research || "");
      document.getElementById("rtMasterPromptTz").value = (mp.master_prompts?.tender_tz_analysis || "");
      document.getElementById("rtMasterPromptSemantic").value = (mp.master_prompts?.semantic_enrichment || "");
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
          tender_tz_analysis: buildRoute("rtTzPrimaryProvider", "rtTzPrimaryEngine", "rtTzFallbackProvider", "rtTzFallbackEngine", "rtTzTokenProvider", "rtTzMaxReq", "rtTzMaxOut"),
        },
        budget: {
          default_price_rub_per_1k_tokens: Number(val("rtPricePer1k") || 0),
        },
        prompts: {
          deal_analysis: document.getElementById("rtPromptDeal").value || "",
        },
      };
      await getJson(api("routing"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      await getJson(api("master-prompt"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          deal_analysis: document.getElementById("rtMasterPromptDeal").value || "",
          client_research: document.getElementById("rtMasterPromptClient").value || "",
          tender_tz_analysis: document.getElementById("rtMasterPromptTz").value || "",
          semantic_enrichment: document.getElementById("rtMasterPromptSemantic").value || "",
        })
      });
      setMsg("Матрица маршрутизации сохранена");
      document.getElementById("routingMsg").textContent = "Сохранено";
      setTimeout(() => {
        const el = document.getElementById("routingMsg");
        if (el) el.textContent = "";
      }, 2500);
    }

    async function loadTenantLimits() {
      const tenantCode = val("limitTenantCode");
      if (!tenantCode) { setErr("Укажи tenant code"); return; }
      const data = await getJson(api("tenant-limits") + "?tenant_code=" + encodeURIComponent(tenantCode));
      const eff = data.effective || {};
      document.getElementById("limitDecisionMonthly").value = eff.decision_support_monthly_per_deal || 10;
      document.getElementById("limitClientCooldownDays").value = eff.client_research_cooldown_days || 180;
      const el = document.getElementById("tenantLimitsMsg");
      if (el) {
        el.textContent = "Лимиты загружены";
        setTimeout(() => { if (el) el.textContent = ""; }, 1800);
      }
    }

    async function saveTenantLimits() {
      const tenantCode = val("limitTenantCode");
      if (!tenantCode) { setErr("Укажи tenant code"); return; }
      await getJson(api("tenant-limits"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          tenant_code: tenantCode,
          decision_support_monthly_per_deal: Number(val("limitDecisionMonthly") || 10),
          client_research_cooldown_days: Number(val("limitClientCooldownDays") || 180),
        }),
      });
      const el = document.getElementById("tenantLimitsMsg");
      if (el) {
        el.textContent = "Лимиты сохранены";
        setTimeout(() => { if (el) el.textContent = ""; }, 2000);
      }
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
        "gigachat": "https://gigachat.devices.sberbank.ru/api/v1",
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


def _urlopen_with_tls(req, timeout=40, allow_insecure=False):
    # First try default TLS validation.
    try:
        return urlopen(req, timeout=timeout)
    except Exception:
        pass

    # Retry with certifi CA bundle if available.
    try:
        import certifi  # type: ignore

        ctx = ssl.create_default_context(cafile=certifi.where())
        return urlopen(req, timeout=timeout, context=ctx)
    except Exception:
        pass

    # Last resort for environments with broken CA chain.
    if allow_insecure:
        insecure_ctx = ssl._create_unverified_context()
        return urlopen(req, timeout=timeout, context=insecure_ctx)

    # Re-run default to preserve original exception details.
    return urlopen(req, timeout=timeout)


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
    role = str(rec.get("role", "")).strip().lower()
    return {"id": uid, "email": rec.get("email", ""), "role": role, "is_active": bool(rec.get("is_active", True))}


def _is_privileged_tenant_user(tenant_user):
    role = str((tenant_user or {}).get("role", "")).strip().lower()
    return role in {"admin", "owner", "founder", "superadmin"}


def _assert_user_can_access_deal(tenant_pb_url, deal_id, tenant_user, admin_token):
    deal = _tenant_api_get(
        tenant_pb_url,
        "deals",
        deal_id,
        admin_token,
        {"expand": "responsible_id"},
    )
    if not isinstance(deal, dict):
        raise RuntimeError("deal not found")
    if _is_privileged_tenant_user(tenant_user):
        return
    owner_id = str(deal.get("responsible_id") or ((deal.get("expand") or {}).get("responsible_id") or {}).get("id") or "").strip()
    uid = str((tenant_user or {}).get("id", "")).strip()
    if owner_id and uid and owner_id != uid:
        raise RuntimeError("forbidden: no access to this deal")


def _check_rate_limit(user_id):
    now = datetime.utcnow()
    slot = PUBLIC_AI_RATE_LIMIT.setdefault(user_id, [])
    threshold = now - timedelta(minutes=1)
    slot[:] = [x for x in slot if x > threshold]
    if len(slot) >= 20:
        return False
    slot.append(now)
    return True


def _check_login_rate(identity):
    now = datetime.utcnow()
    key = str(identity or "").strip().lower() or "unknown"
    slot = LOGIN_RATE_LIMIT.setdefault(key, [])
    threshold = now - timedelta(minutes=5)
    slot[:] = [x for x in slot if x > threshold]
    if len(slot) >= 10:
        return False
    slot.append(now)
    return True


def _mask_email(text):
    s = str(text or "")
    if "@" not in s:
        return s
    parts = s.split("@", 1)
    local = parts[0]
    domain = parts[1]
    if not local:
        return "***@" + domain
    if len(local) <= 2:
        return local[0] + "***@" + domain
    return local[:2] + "***@" + domain


def _mask_phone(text):
    s = str(text or "")
    digits = [ch for ch in s if ch.isdigit()]
    if len(digits) < 7:
        return s
    d = "".join(digits)
    return f"+{d[:2]}***{d[-2:]}"


def _mask_account_like(text):
    s = str(text or "")
    d = "".join(ch for ch in s if ch.isdigit())
    if len(d) < 6:
        return s
    return d[:2] + ("*" * (len(d) - 4)) + d[-2:]


def _default_ai_data_policy():
    return {
        "version": "v1",
        "mode": "allow_all_except_deny",
        "allow_key_patterns": [],
        "deny_key_patterns": [
            "password",
            "pass",
            "token",
            "secret",
            "api_key",
            "cookie",
            "session",
            "credential",
            "passport",
            "snils",
            "card",
            "iban",
            "swift",
            "ogrn",
            "inn",
            "kpp",
            "bik",
            "account",
            "address",
        ],
        "mask_key_patterns": [
            "name",
            "full_name",
            "fio",
            "email",
            "phone",
            "mobile",
            "telegram",
            "whatsapp",
            "inn",
            "kpp",
            "bik",
            "account",
            "address",
        ],
        "redacted_placeholder": "[redacted_by_policy]",
    }


def _get_ai_data_policy():
    policy = _default_ai_data_policy()
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        cur.execute("SELECT value FROM system_settings WHERE key=?", (AI_DATA_POLICY_KEY,))
        row = cur.fetchone()
        con.close()
        if not row or not row[0]:
            return policy
        parsed = json.loads(str(row[0]))
        if isinstance(parsed, dict):
            policy.update(parsed)
    except Exception:
        return policy
    return policy


def _policy_match(patterns, key):
    k = str(key or "").lower()
    for p in patterns or []:
        pp = str(p or "").lower().strip()
        if pp and pp in k:
            return True
    return False


def _sanitize_scalar_by_key(key, value, policy=None):
    policy = policy or _default_ai_data_policy()
    k = str(key or "").lower()
    if _policy_match(policy.get("deny_key_patterns"), k):
        return str(policy.get("redacted_placeholder", "[redacted_by_policy]"))
    s = str(value or "")
    if "email" in k or "mail" in k:
        return _mask_email(s)
    if any(x in k for x in ["phone", "tel", "mobile", "telegram", "whatsapp"]):
        return _mask_phone(s)
    if any(x in k for x in ["inn", "кпп", "kpp", "bik", "счет", "account", "iban", "swift", "ogrn"]):
        return _mask_account_like(s)
    if any(x in k for x in ["full_name", "fio", "name", "contact"]):
        if len(s.split()) >= 2:
            p = s.split()
            masked = [p[0][0] + "***"]
            for x in p[1:]:
                masked.append((x[0] + "***") if x else "")
            return " ".join(masked)
    return s


def _sanitize_text_pii(text):
    s = str(text or "")
    s = re.sub(r"([A-Za-z0-9._%+-]{2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})", r"\1***@\2", s)
    s = re.sub(r"(?<!\d)(\+?\d[\d\-\(\)\s]{8,}\d)(?!\d)", "[masked_phone]", s)
    s = re.sub(r"(?<!\d)\d{10,20}(?!\d)", "[masked_number]", s)
    return s


def _sanitize_for_llm(value, key_hint="", policy=None):
    policy = policy or _default_ai_data_policy()
    if value is None:
        return None
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            kk = str(k)
            mode = str(policy.get("mode", "allow_all_except_deny"))
            if mode == "allowlist" and not _policy_match(policy.get("allow_key_patterns"), kk):
                continue
            if _policy_match(policy.get("deny_key_patterns"), kk):
                out[kk] = str(policy.get("redacted_placeholder", "[redacted_by_policy]"))
                continue
            out[kk] = _sanitize_for_llm(v, kk, policy)
        return out
    if isinstance(value, list):
        return [_sanitize_for_llm(v, key_hint, policy) for v in value]
    if isinstance(value, tuple):
        return [_sanitize_for_llm(v, key_hint, policy) for v in value]
    if isinstance(value, (int, float, bool)):
        return value
    txt = _sanitize_scalar_by_key(key_hint, value, policy)
    return _sanitize_text_pii(txt)


def _quality_gate_check(tenant_pb_url, fallback_used, structured_ok):
    now = datetime.utcnow()
    key = str(tenant_pb_url or "").strip().lower() or "unknown"
    buf = AI_QUALITY_GATE_WINDOW.setdefault(key, [])
    threshold = now - timedelta(hours=1)
    buf[:] = [x for x in buf if x["ts"] > threshold]
    buf.append({"ts": now, "fallback_used": bool(fallback_used), "structured_ok": bool(structured_ok)})
    total = len(buf)
    fallback_count = sum(1 for x in buf if x["fallback_used"])
    structured_count = sum(1 for x in buf if x["structured_ok"])
    fallback_ratio = (fallback_count / total) if total else 0.0
    structured_ratio = (structured_count / total) if total else 0.0
    alert = total >= 8 and (fallback_ratio >= 0.45 or structured_ratio <= 0.55)
    return {
        "window_events_1h": total,
        "fallback_count_1h": fallback_count,
        "structured_count_1h": structured_count,
        "fallback_ratio_1h": round(fallback_ratio, 3),
        "structured_ratio_1h": round(structured_ratio, 3),
        "alert": alert,
    }


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


def _extract_json_value(text):
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    start_obj = text.find("{")
    end_obj = text.rfind("}")
    if start_obj >= 0 and end_obj > start_obj:
        try:
            return json.loads(text[start_obj : end_obj + 1])
        except Exception:
            pass
    start_arr = text.find("[")
    end_arr = text.rfind("]")
    if start_arr >= 0 and end_arr > start_arr:
        try:
            return json.loads(text[start_arr : end_arr + 1])
        except Exception:
            pass
    return None


def _value_to_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)
    except Exception:
        return str(value)


def _has_meaningful_explainability(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set)):
        return len(value) > 0
    if isinstance(value, dict):
        for v in value.values():
            if _has_meaningful_explainability(v):
                return True
        return False
    return True


def _extract_sections_from_plaintext(text):
    txt = str(text or "").strip()
    if not txt:
        return {}
    lines = [ln.rstrip() for ln in txt.splitlines()]
    key_aliases = [
        ("summary", ["summary", "резюме", "вероятность сделки", "оценка сделки"]),
        ("explainability", ["explainability", "объяснение оценки"]),
        ("risks", ["risks", "риск", "риски сделки"]),
        ("upside", ["upside", "точки роста", "growth"]),
        ("next_best_actions", ["next best actions", "следующие шаги", "план действий"]),
        ("data_gaps", ["data gaps", "что не хватает", "чего не хватает", "missing data"]),
        ("commercial_evaluation", ["commercial", "коммерческая оценка"]),
        ("closing_strategy", ["strategy", "стратегия закрытия"]),
        ("executive_summary", ["executive summary", "краткий вывод"]),
        ("suggestions", ["suggestions", "recommendations", "рекомендации"]),
        ("comments", ["comments", "комментарии"]),
    ]

    def detect_heading(line):
        s = line.strip().strip("*").strip()
        if not s:
            return ""
        if s.startswith("#"):
            s = s.lstrip("#").strip()
        if s.endswith(":"):
            s = s[:-1].strip()
        if len(s) > 120:
            return ""
        n = s.lower().replace("ё", "е")
        for key, patterns in key_aliases:
            if any(p in n for p in patterns):
                return key
        return ""

    sections = {}
    preamble = []
    current = ""
    for ln in lines:
        maybe = detect_heading(ln)
        if maybe:
            current = maybe
            sections.setdefault(current, [])
            continue
        if not ln.strip():
            continue
        if current:
            sections.setdefault(current, []).append(ln)
        else:
            preamble.append(ln)

    out = {}
    for k, arr in sections.items():
        val = "\n".join(arr).strip()
        if val:
            out[k] = val
    if preamble and "summary" not in out:
        out["summary"] = "\n".join(preamble[:8]).strip()
    return out


def _llm_result_has_structured_payload(llm_result):
    if not isinstance(llm_result, dict):
        return False
    parsed = llm_result.get("parsed")
    if isinstance(parsed, dict) and bool(parsed):
        return True
    content = str(llm_result.get("content", "") or "")
    parsed_from_content = _extract_json_value(content)
    if isinstance(parsed_from_content, dict) and bool(parsed_from_content):
        return True
    text_sections = _extract_sections_from_plaintext(content)
    return bool(text_sections)


def _normalize_ai_result(raw_content, parsed):
    parsed_from_content = _extract_json_value(raw_content)
    normalized_payload = parsed if isinstance(parsed, dict) and bool(parsed) else None
    if isinstance(parsed_from_content, dict):
        normalized_payload = parsed_from_content
    if not isinstance(normalized_payload, dict):
        text_sections = _extract_sections_from_plaintext(raw_content)
        if text_sections:
            normalized_payload = text_sections

    score = 0
    summary = ""
    suggestions = ""
    risks_value = None
    if isinstance(normalized_payload, dict):
        score_raw = normalized_payload.get("score", 0)
        if score_raw in (None, "", 0, "0"):
            score_raw = normalized_payload.get("probability", score_raw)
        if score_raw in (None, "", 0, "0"):
            score_raw = normalized_payload.get("deal_probability", score_raw)
        try:
            score = max(0, min(100, int(float(score_raw))))
        except Exception:
            score = 0
        summary = _value_to_text(
            normalized_payload.get("summary")
            or normalized_payload.get("executive_summary")
            or normalized_payload.get("comments")
        )
        suggestions = _value_to_text(
            normalized_payload.get("suggestions")
            or normalized_payload.get("recommendations")
            or normalized_payload.get("next_best_actions")
            or normalized_payload.get("action_plan")
        )
        risks_value = normalized_payload.get("risks")
        if risks_value is None:
            risks_value = normalized_payload.get("risk")
    else:
        summary = _value_to_text(parsed_from_content if parsed_from_content is not None else raw_content)

    return {
        "score": score,
        "summary": summary,
        "suggestions": suggestions,
        "risks": risks_value,
        "explainability": normalized_payload if normalized_payload is not None else parsed_from_content,
    }


def _audit_log(event, payload):
    try:
        line = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "event": str(event),
            "payload": payload,
        }
        with open(AI_GATEWAY_AUDIT_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")
    except Exception:
        pass


# Сжатые правила вывода для deal_analysis (дополняют tenant/owner промпт).
AI_DEAL_OUTPUT_RULES = (
    "Правила содержания (обязательно соблюдай в JSON): "
    "Структуру и состав полей бери ИМЕННО из master_prompt и tenant_prompt: "
    "не добавляй лишние обязательные поля, если их не просили, и не опускай запрошенные. "
    "Любой текст должен быть предметным по этой конкретной сделке: имена, этап, числа, даты, сигналы из timeline/context. "
    "Если факта нет в данных — явно помечай как гипотезу или «в CRM не видно». "
    "Для action-oriented разделов (next_steps/recommendations/suggestions и аналоги) пиши конкретные шаги с ролями, темой и горизонтом."
)

AI_CLIENT_RESEARCH_OUTPUT_RULES = (
    "Правила содержания для client_research (обязательно): "
    "верни глубокое исследование в JSON с разделами executive_summary, business_context, it_landscape, "
    "stakeholders_map, pains_confirmed, pains_hypotheses, risks, entry_strategy, action_plan_7_14_30, data_gaps, sources. "
    "Для каждого ключевого вывода укажи evidence/source_ref, а гипотезы явно пометь как hypothesis. "
    "В action_plan дай конкретные шаги с owner, due_window и expected_outcome."
)


def _run_openai_compatible(provider, engine, prompt, task_code="", max_output_tokens=0):
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
                    "Ты AI-помощник отдела продаж. Верни один валидный JSON без markdown. "
                    "Разрешена гибкая структура с любым числом разделов; желательно включать score (0..100), "
                    "summary, suggestions/recommendations и risks."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }
    max_out = int(max_output_tokens or 0)
    if max_out > 0:
        payload["max_tokens"] = max_out
    provider_low = str(provider or "").strip().lower()
    engine_low = str(engine or "").strip().lower()
    if str(task_code or "").strip() == "client_research" and ("kimi" in provider_low or "kimi" in engine_low):
        # Explicit deep-research hint for Kimi/OpenRouter-compatible backends.
        payload["reasoning"] = {"effort": "high"}
    try:
        res = _http_json("POST", url, payload, headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
        choices = res.get("choices", []) if isinstance(res, dict) else []
        content = ""
        if choices and isinstance(choices[0], dict):
            content = str(((choices[0].get("message") or {}).get("content")) or "")
        parsed = _extract_json_object(content)
        usage = res.get("usage", {}) if isinstance(res, dict) else {}
        return {"ok": True, "parsed": parsed, "usage": usage, "content": content}
    except HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        return {"ok": False, "error": f"http {e.code}: {err_body}"}
    except URLError as e:
        return {"ok": False, "error": str(e)}


def _run_gigachat(engine, prompt):
    creds = _provider_creds("gigachat")
    auth_key = creds.get("api_key", "")
    base_url = creds.get("base_url", "").rstrip("/") or "https://gigachat.devices.sberbank.ru/api/v1"
    if not auth_key:
        return {"ok": False, "error": "token for provider 'gigachat' is missing"}

    oauth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    rq_uid = str(uuid.uuid4())
    oauth_headers = {
        "Authorization": f"Basic {auth_key}",
        "RqUID": rq_uid,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    oauth_req = Request(
        url=oauth_url,
        data=b"scope=GIGACHAT_API_PERS",
        headers=oauth_headers,
        method="POST",
    )

    try:
        with _urlopen_with_tls(oauth_req, timeout=40, allow_insecure=(GIGACHAT_INSECURE_TLS == "1")) as r:
            oauth_raw = r.read().decode("utf-8")
        oauth_data = json.loads(oauth_raw) if oauth_raw else {}
        access_token = str(oauth_data.get("access_token", "")).strip()
        if not access_token:
            return {"ok": False, "error": "gigachat oauth failed: no access_token"}

        payload = {
            "model": engine or "GigaChat-2",
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Ты AI-помощник отдела продаж. Верни один валидный JSON без markdown. "
                        "Разрешена гибкая структура с любым числом разделов; желательно включать score (0..100), "
                        "summary, suggestions/recommendations и risks."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
        body = json.dumps(payload).encode("utf-8")
        req = Request(
            url=f"{base_url}/chat/completions",
            data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"},
            method="POST",
        )
        with _urlopen_with_tls(req, timeout=60, allow_insecure=(GIGACHAT_INSECURE_TLS == "1")) as r:
            raw = r.read().decode("utf-8")
        res = json.loads(raw) if raw else {}
        choices = res.get("choices", []) if isinstance(res, dict) else []
        content = ""
        if choices and isinstance(choices[0], dict):
            content = str(((choices[0].get("message") or {}).get("content")) or "")
        parsed = _extract_json_object(content)
        usage = res.get("usage", {}) if isinstance(res, dict) else {}
        return {"ok": True, "parsed": parsed, "usage": usage, "content": content}
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


def _run_provider(provider, engine, prompt, task_code="", max_output_tokens=0):
    p = str(provider).strip().lower()
    if p == "gigachat":
        return _run_gigachat(engine, prompt)
    return _run_openai_compatible(p, engine, prompt, task_code, max_output_tokens)


def _auth_tenant_admin(pb_url):
    base = pb_url.rstrip("/")
    variants = [
        f"{base}/admins/auth-with-password",
        f"{base}/collections/_superusers/auth-with-password",
    ]
    last_error = None
    for url in variants:
        try:
            res = _http_json(
                "POST",
                url,
                {"identity": TENANT_PB_ADMIN_EMAIL, "password": TENANT_PB_ADMIN_PASSWORD},
                timeout=30,
            )
            token = str(res.get("token", "")).strip() if isinstance(res, dict) else ""
            if token:
                return token
        except Exception as e:
            last_error = e
    if last_error:
        raise RuntimeError(f"tenant admin auth failed: {last_error}")
    raise RuntimeError("tenant admin auth failed")


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


def _tenant_api_get(pb_url, collection, record_id, admin_token, query=None):
    base = pb_url.rstrip("/")
    url = f"{base}/collections/{collection}/records/{record_id}"
    if query:
        qs = urlencode({k: str(v) for k, v in query.items() if v is not None})
        if qs:
            url = f"{url}?{qs}"
    return _http_json(
        "GET",
        url,
        None,
        headers={"Authorization": admin_token},
        timeout=30,
    )


def _tenant_api_list(pb_url, collection, params, admin_token):
    base = pb_url.rstrip("/")
    clean = {k: str(v) for k, v in (params or {}).items() if v is not None}
    qs = urlencode(clean)
    if qs:
        url = f"{base}/collections/{collection}/records?{qs}"
    else:
        url = f"{base}/collections/{collection}/records"
    return _http_json("GET", url, None, headers={"Authorization": admin_token}, timeout=30)


def _resolve_tenant_code_from_pb_url(tenant_pb_url):
    host = (urlparse(tenant_pb_url).hostname or "").lower()
    if not host:
        return ""
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cur.execute("SELECT code FROM tenants WHERE lower(primary_domain)=? LIMIT 1", (host,))
    row = cur.fetchone()
    con.close()
    return str(row["code"]) if row and row["code"] else ""


def _append_ai_usage_monthly(tenant_code, usage, cost_rub):
    if not tenant_code:
        return
    period = datetime.utcnow().strftime("%Y-%m")
    input_tokens = int(float((usage or {}).get("prompt_tokens", 0) or 0))
    output_tokens = int(float((usage or {}).get("completion_tokens", 0) or 0))
    request_count = 1
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        "SELECT id, request_count, input_tokens, output_tokens, total_cost_rub FROM ai_usage_monthly WHERE tenant_code=? AND period=? LIMIT 1",
        (tenant_code, period),
    )
    row = cur.fetchone()
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    if row:
        rid, rq, inp, outp, cost = row
        cur.execute(
            """
            UPDATE ai_usage_monthly
            SET request_count=?, input_tokens=?, output_tokens=?, total_cost_rub=?, updated=?
            WHERE id=?
            """,
            (
                int(rq or 0) + request_count,
                int(inp or 0) + input_tokens,
                int(outp or 0) + output_tokens,
                float(cost or 0) + float(cost_rub or 0),
                ts,
                rid,
            ),
        )
    else:
        rid = "r" + secrets.token_hex(7)
        cur.execute(
            """
            INSERT INTO ai_usage_monthly (id, tenant_code, period, request_count, input_tokens, output_tokens, total_cost_rub, created, updated)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (rid, tenant_code, period, request_count, input_tokens, output_tokens, float(cost_rub or 0), ts, ts),
        )
    con.commit()
    con.close()


def _safe_filter_value(raw):
    return str(raw or "").replace("\\", "\\\\").replace('"', '\\"')


def _build_ai_context(tenant_pb_url, deal_id, admin_token, ui_context):
    deal = _tenant_api_get(
        tenant_pb_url,
        "deals",
        deal_id,
        admin_token,
        {"expand": "company_id,stage_id,responsible_id"},
    )
    timeline = _tenant_api_list(
        tenant_pb_url,
        "timeline",
        {"perPage": 200, "sort": "-created", "filter": f'deal_id="{_safe_filter_value(deal_id)}"'},
        admin_token,
    )
    insights = _tenant_api_list(
        tenant_pb_url,
        "ai_insights",
        {"perPage": 20, "sort": "-created", "filter": f'deal_id="{_safe_filter_value(deal_id)}"'},
        admin_token,
    )
    funnel_stages = {"items": []}
    try:
        funnel_stages = _tenant_api_list(
            tenant_pb_url,
            "funnel_stages",
            {"perPage": 200, "sort": "position"},
            admin_token,
        )
    except Exception:
        try:
            funnel_stages = _tenant_api_list(
                tenant_pb_url,
                "settings_funnel_stages",
                {"perPage": 200, "sort": "position"},
                admin_token,
            )
        except Exception:
            funnel_stages = {"items": []}
    events = timeline.get("items", []) if isinstance(timeline, dict) else []
    notes = []
    comments = []
    for e in events:
        action = str(e.get("action", "")).strip().lower()
        row = {
            "created": e.get("created"),
            "action": e.get("action"),
            "comment": e.get("comment"),
            "payload": e.get("payload"),
        }
        if action in ("comment", "note", "workspace_link", "ai_analysis", "task_created"):
            notes.append(row)
        if action == "comment":
            comments.append(row)

    contacts_items = []
    try:
        contacts = _tenant_api_list(
            tenant_pb_url,
            "contacts_found",
            {
                "perPage": 200,
                "sort": "-created",
                "filter": f'deal_id="{_safe_filter_value(deal_id)}"',
            },
            admin_token,
        )
        contacts_items = contacts.get("items", []) if isinstance(contacts, dict) else []
    except Exception:
        contacts_items = []

    entity_file_items = []
    try:
        ef = _tenant_api_list(
            tenant_pb_url,
            "entity_files",
            {
                "perPage": 100,
                "sort": "-created",
                "expand": "file_id",
                "filter": f'entity_type="deal" && entity_id="{_safe_filter_value(deal_id)}"',
            },
            admin_token,
        )
        entity_file_items = ef.get("items", []) if isinstance(ef, dict) else []
    except Exception:
        entity_file_items = []

    frontend_ctx = ui_context if isinstance(ui_context, dict) else {}
    if isinstance(frontend_ctx, dict):
        # Prevent recursive prompt bloat from previous long AI recommendations.
        frontend_ctx = {k: v for k, v in frontend_ctx.items() if str(k) not in ("current_recommendations",)}
    if isinstance(deal, dict):
        deal = dict(deal)
        if "current_recommendations" in deal:
            deal["current_recommendations"] = ""

    context = {
        "source": {
            "frontend_context": frontend_ctx,
            "deal_record": deal if isinstance(deal, dict) else {},
            "timeline_recent": events,
            "notes_recent": notes,
            "comments_recent": comments,
            "ai_insights_recent": insights.get("items", []) if isinstance(insights, dict) else [],
            "contacts_found": contacts_items,
            "entity_files_deal": entity_file_items,
            "funnel_stages": funnel_stages.get("items", []) if isinstance(funnel_stages, dict) else [],
        }
    }
    return context


def _default_scoring_model():
    return {
        "version": "v1",
        "recommended": True,
        "acknowledged": False,
        "llm_blend_percent": 25,
        "factors": [
            {"code": "stage_progress", "name": "Прогресс этапа", "weight": 22, "enabled": True},
            {"code": "decision_maker_coverage", "name": "Покрытие ЛПР/ЛВР", "weight": 18, "enabled": True},
            {"code": "activity_freshness", "name": "Свежесть активности", "weight": 14, "enabled": True},
            {"code": "budget_clarity", "name": "Определенность бюджета", "weight": 14, "enabled": True},
            {"code": "pilot_status", "name": "Статус пилота/пресейла", "weight": 12, "enabled": True},
            {"code": "competition_pressure", "name": "Конкурентное давление", "weight": 10, "enabled": True},
            {"code": "data_completeness", "name": "Полнота данных сделки", "weight": 10, "enabled": True},
        ],
    }


def _to_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return float(default)


def _to_dt(v):
    s = str(v or "").strip()
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
        # Normalize to timezone-aware UTC to avoid naive/aware comparison errors.
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _get_source(full_context):
    if not isinstance(full_context, dict):
        return {}
    src = full_context.get("source")
    return src if isinstance(src, dict) else {}


def _extract_latest_update_text(full_context):
    src = _get_source(full_context)
    frontend_ctx = src.get("frontend_context", {}) if isinstance(src.get("frontend_context"), dict) else {}
    anchor = frontend_ctx.get("latest_update_anchor", {}) if isinstance(frontend_ctx.get("latest_update_anchor"), dict) else {}
    anchor_text = str(anchor.get("text", "")).strip()
    if anchor_text:
        return anchor_text
    comments = src.get("comments_recent", []) if isinstance(src.get("comments_recent"), list) else []
    for item in comments:
        if not isinstance(item, dict):
            continue
        txt = str(item.get("comment", "")).strip()
        if txt:
            return txt
    notes = src.get("notes_recent", []) if isinstance(src.get("notes_recent"), list) else []
    for item in notes:
        if not isinstance(item, dict):
            continue
        txt = str(item.get("comment", "")).strip()
        if txt:
            return txt
    return ""


def _negative_signal_penalty(text):
    t = str(text or "").lower()
    if not t:
        return 0
    # Strong negative signals from manager comments should reduce optimistic drift.
    signals = [
        ("тендер", 3),
        ("под айтеко", 4),
        ("не под нас", 4),
        ("не сможем выиграть", 6),
        ("нет выхода", 6),
        ("конкур", 3),
        ("риск срыва", 5),
        ("непонятно что делать", 4),
        ("блокер", 5),
    ]
    penalty = 0
    for token, score in signals:
        if token in t:
            penalty += score
    return min(18, penalty)


def _calc_factor_value(code, full_context):
    src = _get_source(full_context)
    deal = src.get("deal_record", {}) if isinstance(src.get("deal_record"), dict) else {}
    contacts = src.get("contacts_found", []) if isinstance(src.get("contacts_found"), list) else []
    timeline = src.get("timeline_recent", []) if isinstance(src.get("timeline_recent"), list) else []
    stages = src.get("funnel_stages", []) if isinstance(src.get("funnel_stages"), list) else []

    if code == "stage_progress":
        stage_id = str(deal.get("stage_id") or ((deal.get("expand") or {}).get("stage_id") or {}).get("id") or "")
        if not stage_id or not stages:
            return 50.0
        ordered = sorted(
            [s for s in stages if isinstance(s, dict)],
            key=lambda x: _to_float(x.get("position"), 0),
        )
        total = max(1, len(ordered) - 1)
        idx = 0
        for i, s in enumerate(ordered):
            if str(s.get("id", "")) == stage_id:
                idx = i
                break
        return 35.0 + (idx / total) * 55.0

    if code == "decision_maker_coverage":
        infl = [str((c or {}).get("influence_type", "")).lower() for c in contacts if isinstance(c, dict)]
        has_lpr = any(x == "lpr" for x in infl)
        has_lvr = any(x == "lvr" for x in infl)
        has_infl = any(x in ("influencer", "blocker") for x in infl)
        if has_lpr and has_lvr:
            return 88.0
        if has_lpr:
            return 74.0
        if has_lvr:
            return 62.0
        if has_infl:
            return 46.0
        return 24.0

    if code == "activity_freshness":
        latest = None
        for e in timeline:
            if not isinstance(e, dict):
                continue
            dt = _to_dt(e.get("timestamp") or e.get("created"))
            if dt and (latest is None or dt > latest):
                latest = dt
        if latest is None:
            return 28.0
        days = max(0, (datetime.utcnow().date() - latest.date()).days)
        if days <= 2:
            return 92.0
        if days <= 7:
            return 76.0
        if days <= 14:
            return 60.0
        if days <= 30:
            return 42.0
        return 22.0

    if code == "budget_clarity":
        budget = _to_float(deal.get("budget"), 0)
        turnover = _to_float(deal.get("turnover"), 0)
        if budget > 0:
            return 82.0
        if turnover > 0:
            return 61.0
        return 26.0

    if code == "pilot_status":
        hay = " ".join(
            [
                str(deal.get("presale", "")),
                " ".join(str((e or {}).get("comment", "")) for e in timeline if isinstance(e, dict)),
            ]
        ).lower()
        if any(k in hay for k in ["менее реализуем", "вероятность сниз", "шансы ниже", "блокер", "стоп", "отказ", "замороз"]):
            return 28.0
        if any(k in hay for k in ["пилот окончен", "пилот заверш", "pilot complete", "pilot done", "успешн"]):
            return 90.0
        if "пилот" in hay:
            return 67.0
        return 48.0

    if code == "competition_pressure":
        hay = " ".join(str((e or {}).get("comment", "")) for e in timeline if isinstance(e, dict)).lower()
        if any(k in hay for k in ["менее реализуем", "сделка проседает", "риск срыва", "конкурент", "демпинг", "не согласовали"]):
            return 30.0
        if any(k in hay for k in ["конкур", "айтеко", "тендер", "демпинг"]):
            return 38.0
        return 72.0

    if code == "data_completeness":
        required = [
            bool(str(deal.get("title", "")).strip()),
            bool(str(deal.get("company_id", "")).strip()),
            bool(str(deal.get("stage_id", "")).strip()),
            _to_float(deal.get("budget"), 0) > 0 or _to_float(deal.get("turnover"), 0) > 0,
            bool(str(deal.get("activity_type", "")).strip()),
            bool(str(deal.get("presale", "")).strip()),
        ]
        ratio = sum(1 for x in required if x) / max(1, len(required))
        return 20.0 + ratio * 75.0

    return 50.0


def _get_tenant_scoring_model(tenant_pb_url, admin_token):
    fallback = _default_scoring_model()
    try:
        packs = _tenant_api_list(
            tenant_pb_url,
            "semantic_packs",
            {
                "perPage": 1,
                "sort": "-created",
                "filter": 'type="deal_scoring_model" && model="deal_scoring_model_v1"',
            },
            admin_token,
        )
        items = packs.get("items", []) if isinstance(packs, dict) else []
        if not items:
            return {"record_id": "", "model": fallback}
        rec = items[0] if isinstance(items[0], dict) else {}
        variants = rec.get("variants")
        parsed = None
        if isinstance(variants, dict):
            parsed = variants
        elif isinstance(variants, str):
            try:
                maybe = json.loads(variants)
                if isinstance(maybe, dict):
                    parsed = maybe
            except Exception:
                parsed = None
        if not isinstance(parsed, dict):
            parsed = {}
        model = dict(fallback)
        model.update(parsed)
        if not isinstance(model.get("factors"), list) or not model.get("factors"):
            model["factors"] = fallback["factors"]
        return {"record_id": str(rec.get("id", "")), "model": model}
    except Exception:
        return {"record_id": "", "model": fallback}


def _compute_deterministic_score(scoring_model, full_context, llm_score):
    model = scoring_model if isinstance(scoring_model, dict) else _default_scoring_model()
    factors = model.get("factors", []) if isinstance(model.get("factors"), list) else []
    breakdown = []
    weighted_sum = 0.0
    weight_total = 0.0
    for f in factors:
        if not isinstance(f, dict):
            continue
        enabled = bool(f.get("enabled", True))
        weight = max(0.0, _to_float(f.get("weight", 0), 0))
        code = str(f.get("code", "")).strip()
        name = str(f.get("name", code or "factor")).strip() or code or "factor"
        if not enabled or not code or weight <= 0:
            continue
        val = max(0.0, min(100.0, _calc_factor_value(code, full_context)))
        contrib = (val * weight) / 100.0
        breakdown.append(
            {
                "code": code,
                "name": name,
                "weight": round(weight, 2),
                "value": round(val, 2),
                "weighted_contribution": round(contrib, 2),
            }
        )
        weighted_sum += val * weight
        weight_total += weight
    if weight_total <= 0:
        return {
            "score": int(max(0, min(100, _to_float(llm_score, 0)))),
            "method": "llm_fallback",
            "breakdown": breakdown,
        }
    deterministic_score = int(max(0, min(100, round(weighted_sum / weight_total))))
    llm_score_num = int(max(0, min(100, round(_to_float(llm_score, 0)))))
    blend_percent = int(max(0, min(100, round(_to_float(model.get("llm_blend_percent", 25), 25)))))
    if llm_score_num > 0 and blend_percent > 0:
        final_score = int(round((deterministic_score * (100 - blend_percent) + llm_score_num * blend_percent) / 100.0))
        method = "weighted_factors_v1_plus_llm"
    else:
        final_score = deterministic_score
        method = "weighted_factors_v1"
    return {"score": final_score, "method": method, "breakdown": breakdown}


def _build_fallback_analysis_from_scoring(full_context, score, scoring_breakdown):
    src = _get_source(full_context)
    deal = src.get("deal_record", {}) if isinstance(src.get("deal_record"), dict) else {}
    stage_name = str((((deal.get("expand") or {}).get("stage_id") or {}).get("stage_name") or "").strip() or str(deal.get("stage_id", "")).strip() or "не указан")
    company_name = str((((deal.get("expand") or {}).get("company_id") or {}).get("name") or "").strip() or "клиент")
    budget = _to_float(deal.get("budget"), 0)
    turnover = _to_float(deal.get("turnover"), 0)

    summary_parts = [
        f"Сделка '{str(deal.get('title', '')).strip() or 'без названия'}' у {company_name} на этапе '{stage_name}'.",
        f"Детерминированная вероятность закрытия: {int(score)}/100 по факторной модели.",
    ]
    if budget > 0:
        summary_parts.append(f"Бюджет в CRM: {int(budget)}.")
    elif turnover > 0:
        summary_parts.append(f"Ориентир по обороту: {int(turnover)}.")

    low = [b for b in (scoring_breakdown or []) if isinstance(b, dict) and _to_float(b.get("value"), 100) < 55]
    if low:
        top = sorted(low, key=lambda x: _to_float(x.get("value"), 100))[:3]
        names = ", ".join(str(x.get("name", x.get("code", "фактор"))) for x in top)
        summary_parts.append(f"Основные зоны риска по модели: {names}.")

    summary = " ".join(summary_parts).strip()

    actions = []
    for b in sorted(low, key=lambda x: _to_float(x.get("value"), 100))[:5]:
        code = str(b.get("code", ""))
        if code == "decision_maker_coverage":
            actions.append("1) За 3 дня выйти на ЛПР/ЛВР, подтвердить состав стейкхолдеров и критерии принятия решения.")
        elif code == "competition_pressure":
            actions.append("2) За 5 дней собрать конкурентную карту (кто, за счёт чего, где слабые места) и обновить позиционирование КП.")
        elif code == "stage_progress":
            actions.append("3) За 2 дня согласовать следующий milestone по этапу и зафиксировать дедлайн в timeline.")
        elif code == "budget_clarity":
            actions.append("4) За 3 дня подтвердить бюджетный контур: диапазон, источник, условия оплаты и ограничения.")
        elif code == "data_completeness":
            actions.append("5) За 2 дня дозаполнить ключевые поля сделки и артефакты для качественного прогноза.")
        elif code == "pilot_status":
            actions.append("6) За 4 дня оформить post-pilot протокол: результаты, отклонения, решение по масштабированию.")
        elif code == "activity_freshness":
            actions.append("7) В течение 48 часов провести касание с клиентом и зафиксировать результат в timeline.")
    if not actions:
        actions = [
            "1) В течение 48 часов уточнить следующий шаг сделки с ЛПР и зафиксировать дедлайн.",
            "2) За 3 дня синхронизировать бюджет/объём/сроки с клиентом и обновить карточку сделки.",
            "3) За 5 дней провести risk-review по конкуренции и подготовить контраргументы в КП.",
        ]
    suggestions = "\n".join(actions[:7]).strip()

    risks = []
    for b in sorted(low, key=lambda x: _to_float(x.get("value"), 100))[:3]:
        val = _to_float(b.get("value"), 50)
        crit = "low"
        if val < 35:
            crit = "high"
        elif val < 55:
            crit = "medium"
        risks.append(
            {
                "name": str(b.get("name", b.get("code", "risk"))),
                "description": f"Фактор '{str(b.get('code', ''))}' имеет низкое значение {round(val, 1)}.",
                "criticality": crit,
                "probability": int(max(10, min(95, round(100 - val)))),
            }
        )
    if not risks:
        risks = [
            {"name": "Недостаток данных", "description": "В контексте недостаточно сигналов для полноценного вывода модели.", "criticality": "medium", "probability": 45}
        ]
    return {"summary": summary, "suggestions": suggestions, "risks": risks}


def _master_prompt_key_by_task(task_code):
    code = str(task_code or "").strip().lower()
    if code == "client_research":
        return MASTER_PROMPT_KEY_CLIENT_RESEARCH
    if code == "tender_tz_analysis":
        return MASTER_PROMPT_KEY_TZ_ANALYSIS
    if code == "semantic_enrichment":
        return MASTER_PROMPT_KEY_SEMANTIC_ENRICHMENT
    return MASTER_PROMPT_KEY_DEAL_ANALYSIS


def _get_master_prompts():
    keys = {
        "deal_analysis": MASTER_PROMPT_KEY_DEAL_ANALYSIS,
        "client_research": MASTER_PROMPT_KEY_CLIENT_RESEARCH,
        "tender_tz_analysis": MASTER_PROMPT_KEY_TZ_ANALYSIS,
        "semantic_enrichment": MASTER_PROMPT_KEY_SEMANTIC_ENRICHMENT,
    }
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    out = {}
    for k, setting_key in keys.items():
        cur.execute("SELECT value FROM system_settings WHERE key=?", (setting_key,))
        row = cur.fetchone()
        out[k] = str(row[0]).strip() if row and row[0] else ""
    con.close()
    return out


def _get_master_prompt_deal_analysis():
    return _get_master_prompts().get("deal_analysis", "")


def _save_master_prompts(payload):
    values = payload if isinstance(payload, dict) else {}
    keys = {
        "deal_analysis": MASTER_PROMPT_KEY_DEAL_ANALYSIS,
        "client_research": MASTER_PROMPT_KEY_CLIENT_RESEARCH,
        "tender_tz_analysis": MASTER_PROMPT_KEY_TZ_ANALYSIS,
        "semantic_enrichment": MASTER_PROMPT_KEY_SEMANTIC_ENRICHMENT,
    }
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    for field, setting_key in keys.items():
        value = str(values.get(field, "")).strip()
        cur.execute("SELECT id FROM system_settings WHERE key=?", (setting_key,))
        row = cur.fetchone()
        if row:
            cur.execute("UPDATE system_settings SET value=?, updated=? WHERE key=?", (value, ts, setting_key))
        else:
            rid = "r" + secrets.token_hex(7)
            cur.execute(
                """
                INSERT INTO system_settings (id, key, value, description, group_name, is_public, created, updated)
                VALUES (?,?,?,?,?,?,?,?)
                """,
                (
                    rid,
                    setting_key,
                    value,
                    f"Master prompt (founder-only) for {field}",
                    "ai",
                    0,
                    ts,
                    ts,
                ),
            )
    con.commit()
    con.close()
    return {"ok": True}


def _save_ai_data_policy(payload):
    policy = _default_ai_data_policy()
    if isinstance(payload, dict):
        policy.update(payload)
    value = json.dumps(policy, ensure_ascii=False)
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT id FROM system_settings WHERE key=?", (AI_DATA_POLICY_KEY,))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE system_settings SET value=?, updated=? WHERE key=?", (value, ts, AI_DATA_POLICY_KEY))
    else:
        rid = "r" + secrets.token_hex(7)
        cur.execute(
            """
            INSERT INTO system_settings (id, key, value, description, group_name, is_public, created, updated)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (
                rid,
                AI_DATA_POLICY_KEY,
                value,
                "AI data policy: allow/deny/mask rules for outbound LLM context",
                "ai",
                0,
                ts,
                ts,
            ),
        )
    con.commit()
    con.close()
    return {"ok": True, "policy": policy}


def _get_tenant_prompt(tenant_pb_url, admin_token, task_code="deal_analysis"):
    model_by_task = {
        "deal_analysis": "deal_analysis_prompt",
        "deal_update_analysis": "deal_analysis_prompt",
        "decision_support": "deal_analysis_prompt",
        "client_research": "client_research_prompt",
        "tender_tz_analysis": "tz_analysis_prompt",
        "semantic_enrichment": "semantic_enrichment_prompt",
    }
    model = model_by_task.get(str(task_code or "").strip(), "deal_analysis_prompt")
    try:
        packs = _tenant_api_list(
            tenant_pb_url,
            "semantic_packs",
            {
                "perPage": 1,
                "sort": "-created",
                "filter": f'type="deal" && model="{model}"',
            },
            admin_token,
        )
        items = packs.get("items", []) if isinstance(packs, dict) else []
        if items:
            txt = str((items[0] or {}).get("base_text", "")).strip()
            if txt:
                return txt
    except Exception:
        pass
    # Backward compatibility: if scenario-specific prompt is not set, fallback to deal_analysis_prompt.
    if model != "deal_analysis_prompt":
        try:
            packs = _tenant_api_list(
                tenant_pb_url,
                "semantic_packs",
                {
                    "perPage": 1,
                    "sort": "-created",
                    "filter": 'type="deal" && model="deal_analysis_prompt"',
                },
                admin_token,
            )
            items = packs.get("items", []) if isinstance(packs, dict) else []
            if items:
                txt = str((items[0] or {}).get("base_text", "")).strip()
                if txt:
                    return txt
        except Exception:
            pass
    return ""


def _extract_company_product_for_cooldown(full_context):
    src = _get_source(full_context)
    frontend_ctx = src.get("frontend_context", {}) if isinstance(src.get("frontend_context"), dict) else {}
    deal = src.get("deal_record", {}) if isinstance(src.get("deal_record"), dict) else {}
    company_id = str(frontend_ctx.get("company_id") or deal.get("company_id") or "").strip()
    product_id = str(frontend_ctx.get("product_id") or deal.get("product_id") or "").strip()
    return company_id, product_id


def _read_json_system_setting(key):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT value FROM system_settings WHERE key=?", (key,))
    row = cur.fetchone()
    con.close()
    if not row or not row[0]:
        return {}
    try:
        data = json.loads(str(row[0]))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _write_json_system_setting(key, value, description):
    payload = json.dumps(value if isinstance(value, dict) else {}, ensure_ascii=False)
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%fZ")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT id FROM system_settings WHERE key=?", (key,))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE system_settings SET value=?, updated=? WHERE key=?", (payload, ts, key))
    else:
        rid = "r" + secrets.token_hex(7)
        cur.execute(
            """
            INSERT INTO system_settings (id, key, value, description, group_name, is_public, created, updated)
            VALUES (?,?,?,?,?,?,?,?)
            """,
            (rid, key, payload, description, "ai", 0, ts, ts),
        )
    con.commit()
    con.close()


def _normalize_limit_int(value, default_value, min_value=1, max_value=3650):
    try:
        n = int(float(value))
    except Exception:
        n = int(default_value)
    return max(int(min_value), min(int(max_value), n))


def _get_tenant_limits():
    raw = _read_json_system_setting(AI_TENANT_LIMITS_KEY)
    defaults = raw.get("default", {}) if isinstance(raw.get("default"), dict) else {}
    tenants = raw.get("tenants", {}) if isinstance(raw.get("tenants"), dict) else {}
    out = {
        "default": {
            "decision_support_monthly_per_deal": _normalize_limit_int(defaults.get("decision_support_monthly_per_deal", 10), 10, 1, 1000),
            "client_research_cooldown_days": _normalize_limit_int(defaults.get("client_research_cooldown_days", 180), 180, 1, 3650),
        },
        "tenants": {},
    }
    for tcode, cfg in tenants.items():
        if not isinstance(cfg, dict):
            continue
        out["tenants"][str(tcode).strip()] = {
            "decision_support_monthly_per_deal": _normalize_limit_int(cfg.get("decision_support_monthly_per_deal", out["default"]["decision_support_monthly_per_deal"]), out["default"]["decision_support_monthly_per_deal"], 1, 1000),
            "client_research_cooldown_days": _normalize_limit_int(cfg.get("client_research_cooldown_days", out["default"]["client_research_cooldown_days"]), out["default"]["client_research_cooldown_days"], 1, 3650),
        }
    return out


def _resolve_tenant_limits(tenant_code):
    limits = _get_tenant_limits()
    out = dict(limits.get("default", {}))
    if tenant_code and tenant_code in limits.get("tenants", {}):
        out.update(limits["tenants"][tenant_code])
    return out


def _save_tenant_limit_override(payload):
    tenant_code = str(payload.get("tenant_code", "")).strip()
    if not tenant_code:
        return {"ok": False, "error": "tenant_code is required"}
    limits = _get_tenant_limits()
    tenants = limits.get("tenants", {})
    current = tenants.get(tenant_code, {})
    current["decision_support_monthly_per_deal"] = _normalize_limit_int(
        payload.get("decision_support_monthly_per_deal", current.get("decision_support_monthly_per_deal", limits["default"]["decision_support_monthly_per_deal"])),
        limits["default"]["decision_support_monthly_per_deal"],
        1,
        1000,
    )
    current["client_research_cooldown_days"] = _normalize_limit_int(
        payload.get("client_research_cooldown_days", current.get("client_research_cooldown_days", limits["default"]["client_research_cooldown_days"])),
        limits["default"]["client_research_cooldown_days"],
        1,
        3650,
    )
    tenants[tenant_code] = current
    _write_json_system_setting(
        AI_TENANT_LIMITS_KEY,
        {"default": limits.get("default", {}), "tenants": tenants},
        "Per-tenant overrides for AI scenario limits",
    )
    return {"ok": True, "tenant_code": tenant_code, "limits": current}


def _get_tenant_limit_override(tenant_code):
    tenant_code = str(tenant_code or "").strip()
    limits = _get_tenant_limits()
    return {
        "ok": True,
        "tenant_code": tenant_code,
        "default": limits.get("default", {}),
        "override": (limits.get("tenants", {}) or {}).get(tenant_code, {}),
        "effective": _resolve_tenant_limits(tenant_code),
    }


def _check_and_mark_client_research_cooldown(tenant_code, company_id, product_id, days=180):
    if not tenant_code or not company_id or not product_id:
        return {"ok": False, "error": "company_id and product_id are required for client_research"}
    data = _read_json_system_setting(AI_CLIENT_RESEARCH_COOLDOWN_KEY)
    records = data.get("records", []) if isinstance(data.get("records"), list) else []
    now = datetime.now(timezone.utc)
    key = f"{tenant_code}:{company_id}:{product_id}:client_research"
    active = []
    blocked_until = None
    for rec in records:
        if not isinstance(rec, dict):
            continue
        rec_key = str(rec.get("key", "")).strip()
        next_at_raw = str(rec.get("next_allowed_at", "")).strip()
        next_dt = _to_dt(next_at_raw)
        if not rec_key or not next_dt:
            continue
        if next_dt > now:
            active.append({"key": rec_key, "next_allowed_at": next_dt.isoformat() + "Z"})
            if rec_key == key:
                blocked_until = next_dt
    if blocked_until:
        return {"ok": False, "next_allowed_at": blocked_until.isoformat() + "Z"}
    next_allowed = now + timedelta(days=int(days or 180))
    active.append({"key": key, "next_allowed_at": next_allowed.isoformat() + "Z"})
    _write_json_system_setting(
        AI_CLIENT_RESEARCH_COOLDOWN_KEY,
        {"records": active},
        "Cooldown keys for tenant/product/company client research runs",
    )
    return {"ok": True, "next_allowed_at": next_allowed.isoformat() + "Z"}


def _check_and_mark_decision_support_monthly_limit(tenant_code, deal_id, limit_per_month=10):
    if not tenant_code or not deal_id:
        return {"ok": False, "error": "tenant_code and deal_id are required for decision_support"}
    data = _read_json_system_setting(AI_DECISION_SUPPORT_LIMIT_KEY)
    records = data.get("records", []) if isinstance(data.get("records"), list) else []
    month_key = datetime.utcnow().strftime("%Y-%m")
    key = f"{tenant_code}:{deal_id}:{month_key}:decision_support"
    active = []
    current_count = 0
    for rec in records:
        if not isinstance(rec, dict):
            continue
        rec_key = str(rec.get("key", "")).strip()
        if not rec_key or not rec_key.endswith(":decision_support"):
            continue
        if f":{month_key}:" not in rec_key:
            continue
        cnt = int(rec.get("count", 0) or 0)
        if rec_key == key:
            current_count = cnt
            active.append({"key": rec_key, "count": cnt + 1})
        else:
            active.append({"key": rec_key, "count": cnt})
    if current_count == 0:
        active.append({"key": key, "count": 1})
    if current_count >= int(limit_per_month):
        return {"ok": False, "error": f"decision_support limit exceeded ({limit_per_month}/month per deal)"}
    _write_json_system_setting(
        AI_DECISION_SUPPORT_LIMIT_KEY,
        {"records": active},
        "Monthly per-deal limits for decision support calls",
    )
    return {"ok": True, "used": current_count + 1, "limit": int(limit_per_month)}


def _resolve_product_prompt(full_context, task_code):
    src = _get_source(full_context)
    frontend_ctx = src.get("frontend_context", {}) if isinstance(src.get("frontend_context"), dict) else {}
    product_profile = frontend_ctx.get("product_profile", {}) if isinstance(frontend_ctx.get("product_profile"), dict) else {}
    by_task = {
        "deal_analysis": "ai_prompt_deal",
        "deal_update_analysis": "ai_prompt_deal",
        "decision_support": "ai_prompt_deal",
        "client_research": "ai_prompt_client_research",
        "tender_tz_analysis": "ai_prompt_tz_analysis",
    }
    key = by_task.get(task_code, "")
    if key:
        txt = str(product_profile.get(key, "")).strip()
        if txt:
            return txt
    return ""

def run_ai_deal_analysis(payload):
    deal_id = str(payload.get("deal_id", "")).strip()
    tenant_pb_url = str(payload.get("tenant_pb_url", "")).strip().rstrip("/")
    task_code = str(payload.get("task_code", "deal_analysis")).strip() or "deal_analysis"
    user_id = str(payload.get("user_id", "")).strip()
    tenant_user_token = str(payload.get("tenant_user_token", "")).strip()
    context = payload.get("context", {}) if isinstance(payload.get("context"), dict) else {}
    data_policy = _get_ai_data_policy()
    safe_request_context = _sanitize_for_llm(context, "context", data_policy)
    _audit_log(
        "analyze_request",
        {
            "deal_id": deal_id,
            "tenant_pb_url": tenant_pb_url,
            "task_code": task_code,
            "user_id": user_id,
            "context": safe_request_context,
        },
    )
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
    if not bool(tenant_user.get("is_active", True)):
        return {"ok": False, "error": "tenant user is inactive"}
    if not _check_rate_limit(str(tenant_user.get("id", ""))):
        return {"ok": False, "error": "rate limit exceeded: max 20 requests/min per user"}
    if not user_id:
        user_id = str(tenant_user.get("id", ""))

    routing = get_routing_matrix()
    routes_map = (routing.get("routes", {}) or {})
    default_routes_map = (default_routing_matrix().get("routes", {}) or {})
    route_aliases = {
        "deal_update_analysis": "deal_analysis",
        "client_enrichment": "client_research",
    }
    resolved_task_code = route_aliases.get(task_code, task_code)
    route = routes_map.get(resolved_task_code, {})
    if not isinstance(route, dict):
        route = {}
    # Safety fallback: if route is missing or partially broken in persisted routing,
    # recover from built-in defaults so scenario does not fail in runtime.
    if not route or not str(route.get("primary_provider", "")).strip() or not str(route.get("primary_engine", "")).strip():
        fallback_default = default_routes_map.get(resolved_task_code, {})
        if isinstance(fallback_default, dict):
            merged = dict(fallback_default)
            merged.update(route)
            route = merged
    primary_provider = str(route.get("primary_provider", "")).strip().lower()
    primary_engine = str(route.get("primary_engine", "")).strip()
    fallback_provider = str(route.get("fallback_provider", "")).strip().lower()
    fallback_engine = str(route.get("fallback_engine", "")).strip()
    max_output_tokens = int(route.get("max_output_tokens", 0) or 0)
    if task_code == "client_research":
        # Respect founder routing choice for provider/engine.
        # Use OpenRouter-oriented defaults only when fields are missing.
        if not primary_provider:
            primary_provider = "or_kimi"
        if not primary_engine:
            primary_engine = "moonshotai/kimi-k2.5"
        if not fallback_provider:
            fallback_provider = "or_qwen"
        if not fallback_engine:
            fallback_engine = "qwen/qwen3-235b-a22b"
        if max_output_tokens < 3200:
            max_output_tokens = 3200

    if not primary_provider or not primary_engine:
        return {"ok": False, "error": f"routing for '{task_code}' is not configured"}
    try:
        admin_token = _auth_tenant_admin(tenant_pb_url)
    except Exception as e:
        return {"ok": False, "error": f"tenant admin auth failed: {e}"}
    try:
        _assert_user_can_access_deal(tenant_pb_url, deal_id, tenant_user, admin_token)
    except Exception as e:
        return {"ok": False, "error": str(e)}

    context_mode = str((context or {}).get("analysis_mode", "")).strip().lower()
    is_update_mode = task_code == "deal_update_analysis" or context_mode == "update"
    full_context = _build_ai_context(tenant_pb_url, deal_id, admin_token, context)
    tenant_code = _resolve_tenant_code_from_pb_url(tenant_pb_url)
    company_id, product_id = _extract_company_product_for_cooldown(full_context)
    tenant_limits = _resolve_tenant_limits(tenant_code)
    if task_code == "client_research":
        cooldown_days = int(tenant_limits.get("client_research_cooldown_days", 180) or 180)
        cooldown = _check_and_mark_client_research_cooldown(tenant_code, company_id, product_id, cooldown_days)
        if not cooldown.get("ok"):
            next_allowed = str(cooldown.get("next_allowed_at", "")).strip()
            if next_allowed:
                return {"ok": False, "error": f"client_research cooldown active until {next_allowed}"}
            return {"ok": False, "error": str(cooldown.get("error", "client_research cooldown failed"))}
    if task_code == "decision_support":
        month_limit = int(tenant_limits.get("decision_support_monthly_per_deal", 10) or 10)
        decision_limit = _check_and_mark_decision_support_monthly_limit(tenant_code, deal_id, month_limit)
        if not decision_limit.get("ok"):
            return {"ok": False, "error": str(decision_limit.get("error", "decision_support limit failed"))}
    llm_context = _sanitize_for_llm(full_context, "context", data_policy)
    prompts_map = (routing.get("prompts", {}) if isinstance(routing.get("prompts"), dict) else {})
    owner_prompt = str((prompts_map.get("deal_update_analysis") if is_update_mode else prompts_map.get(task_code)) or "").strip()
    if not owner_prompt:
        owner_prompt = str((prompts_map.get("deal_analysis") or "")).strip()
    tenant_prompt = _get_tenant_prompt(tenant_pb_url, admin_token, task_code)
    master_prompts = _get_master_prompts()
    master_prompt = str(master_prompts.get(task_code, "")).strip()
    if not master_prompt:
        master_prompt = _get_master_prompt_deal_analysis()
    scoring_bundle = _get_tenant_scoring_model(tenant_pb_url, admin_token)
    scoring_model = scoring_bundle.get("model", _default_scoring_model())
    deal_prompt = tenant_prompt or owner_prompt
    product_prompt = _resolve_product_prompt(full_context, task_code)
    if product_prompt:
        deal_prompt = f"{deal_prompt}\n\nПродуктовый контекст и правила:\n{product_prompt}".strip()
    if not deal_prompt:
        deal_prompt = (
            "Проанализируй сделку и дай оценку риска/шансов. Учитывай динамику комментариев, заметки, timeline и предыдущие AI-оценки."
        )
    update_instruction = ""
    if is_update_mode:
        update_instruction = (
            "Режим UPDATE-анализа: это НЕ первичное исследование. "
            "Сфокусируйся на изменениях после прошлого AI-среза: "
            "что улучшилось, что ухудшилось, как изменилась вероятность закрытия и какие 3-5 действий приоритетны в ближайшие 24-72 часа.\n"
        )
    deep_research_instruction = ""
    if task_code == "client_research":
        deep_research_instruction = (
            "Режим DEEP_RESEARCH: выполни глубокое исследование клиента под продукт. "
            "Сначала собери и проверь сигналы, затем выдай структурированный итог с разделением на факты/гипотезы, "
            "карту ЛПР/ЛВР/блокеров, подтвержденные боли, зрелость, риски, окна входа и план действий на 7/14/30 дней. "
            "Отдельно перечисли data-gaps и какие вопросы задать клиенту для валидации гипотез.\n"
        )
    output_rules = AI_DEAL_OUTPUT_RULES
    if task_code == "client_research":
        output_rules = AI_CLIENT_RESEARCH_OUTPUT_RULES
    prompt = (
        f"{deal_prompt}\n"
        + (f"{master_prompt}\n" if master_prompt else "")
        + update_instruction
        + deep_research_instruction
        + f"Контекст сделки (JSON): {json.dumps(llm_context, ensure_ascii=False)}\n"
        "Формат ответа: один валидный JSON-объект без markdown и без текста вне JSON.\n"
        + output_rules
    )

    llm_result = _run_provider(primary_provider, primary_engine, prompt, task_code, max_output_tokens)
    used_provider = primary_provider
    used_engine = primary_engine
    primary_error = ""
    fallback_error = ""
    primary_structured = _llm_result_has_structured_payload(llm_result)
    if not llm_result.get("ok"):
        primary_error = str(llm_result.get("error", "primary provider failed"))
    elif not primary_structured:
        primary_error = "primary returned unstructured/empty payload"
    parsed_payload = llm_result.get("parsed", {})
    parsed_payload_safe = _sanitize_for_llm(parsed_payload, "parsed", data_policy) if isinstance(parsed_payload, dict) else parsed_payload
    content_preview = ""
    if isinstance(parsed_payload, dict) and not parsed_payload:
        content_preview = _sanitize_text_pii(str(llm_result.get("content", "") or ""))[:1500]
    _audit_log(
        "provider_attempt",
        {
            "deal_id": deal_id,
            "provider": primary_provider,
            "engine": primary_engine,
            "ok": bool(llm_result.get("ok")),
            "error": llm_result.get("error", ""),
            "usage": llm_result.get("usage", {}),
            "parsed": parsed_payload_safe,
            "content_preview": content_preview,
        },
    )
    should_try_fallback = (not llm_result.get("ok")) or (not primary_structured)
    if should_try_fallback and fallback_provider and fallback_engine:
        # Only fallback if token for fallback provider is configured.
        fb_creds = _provider_creds(fallback_provider)
        if fb_creds.get("api_key"):
            llm_result = _run_provider(fallback_provider, fallback_engine, prompt, task_code, max_output_tokens)
            used_provider = fallback_provider
            used_engine = fallback_engine
            if not llm_result.get("ok"):
                fallback_error = str(llm_result.get("error", "fallback provider failed"))
            elif not _llm_result_has_structured_payload(llm_result):
                fallback_error = "fallback returned unstructured/empty payload"
            fb_parsed_payload = llm_result.get("parsed", {})
            fb_parsed_payload_safe = _sanitize_for_llm(fb_parsed_payload, "parsed", data_policy) if isinstance(fb_parsed_payload, dict) else fb_parsed_payload
            fb_content_preview = ""
            if isinstance(fb_parsed_payload, dict) and not fb_parsed_payload:
                fb_content_preview = _sanitize_text_pii(str(llm_result.get("content", "") or ""))[:1500]
            _audit_log(
                "provider_attempt",
                {
                    "deal_id": deal_id,
                    "provider": fallback_provider,
                    "engine": fallback_engine,
                    "ok": bool(llm_result.get("ok")),
                    "error": llm_result.get("error", ""),
                    "usage": llm_result.get("usage", {}),
                    "parsed": fb_parsed_payload_safe,
                    "content_preview": fb_content_preview,
                },
            )
        else:
            fallback_error = f"token for provider '{fallback_provider}' is missing"
            _audit_log(
                "provider_attempt",
                {
                    "deal_id": deal_id,
                    "provider": fallback_provider,
                    "engine": fallback_engine,
                    "ok": False,
                    "error": fallback_error,
                },
            )
    if not llm_result.get("ok"):
        details = []
        if primary_error:
            details.append(f"primary {primary_provider}:{primary_engine} -> {primary_error}")
        if fallback_provider:
            if fallback_error:
                details.append(f"fallback {fallback_provider}:{fallback_engine} -> {fallback_error}")
            else:
                details.append(f"fallback {fallback_provider}:{fallback_engine} not configured")
        err = " | ".join(details) if details else "llm request failed"
        _audit_log("analyze_failed", {"deal_id": deal_id, "error": err})
        return {"ok": False, "error": err}

    parsed = llm_result.get("parsed", {}) if isinstance(llm_result.get("parsed"), dict) else {}
    raw_content = str(llm_result.get("content", "") or "")
    usage = llm_result.get("usage", {}) if isinstance(llm_result.get("usage"), dict) else {}
    normalized = _normalize_ai_result(raw_content, parsed)
    llm_score = normalized.get("score", 0)
    deterministic = _compute_deterministic_score(scoring_model, full_context, llm_score)
    score = deterministic.get("score", 0)
    summary = str(normalized.get("summary", "")).strip()
    suggestions = str(normalized.get("suggestions", "")).strip()
    risks_value = normalized.get("risks")
    explainability = normalized.get("explainability")
    if task_code == "client_research":
        # Do not force deal-scoring fallback templates into client research output.
        if isinstance(explainability, dict):
            if not summary:
                summary = _value_to_text(
                    explainability.get("executive_summary")
                    or explainability.get("research_summary")
                    or explainability.get("deal_health")
                )
            if not suggestions:
                suggestions = _value_to_text(
                    explainability.get("action_plan_7_14_30")
                    or explainability.get("next_steps")
                    or explainability.get("entry_strategy")
                )
        if llm_score and int(llm_score) > 0:
            score = int(max(0, min(100, int(llm_score))))
    if isinstance(explainability, dict):
        explainability["_scoring"] = {
            "model": scoring_model,
            "method": deterministic.get("method"),
            "breakdown": deterministic.get("breakdown", []),
            "final_probability": score,
            "llm_probability_raw": llm_score,
        }
    else:
        explainability = {
            "raw_model_output": explainability,
            "_scoring": {
                "model": scoring_model,
                "method": deterministic.get("method"),
                "breakdown": deterministic.get("breakdown", []),
                "final_probability": score,
                "llm_probability_raw": llm_score,
            },
        }
    need_fallback = (not summary) or (not suggestions) or (risks_value in (None, "", [], {}))
    if task_code == "client_research":
        need_fallback = False
    if need_fallback:
        fb = _build_fallback_analysis_from_scoring(full_context, score, deterministic.get("breakdown", []))
        if not summary:
            summary = str(fb.get("summary", "")).strip()
        if not suggestions:
            suggestions = str(fb.get("suggestions", "")).strip()
        if risks_value in (None, "", [], {}):
            risks_value = fb.get("risks")
    latest_update_text = _extract_latest_update_text(full_context)
    if is_update_mode and latest_update_text:
        penalty = _negative_signal_penalty(latest_update_text)
        if penalty > 0:
            score = int(max(0, min(100, score - penalty)))
            explainability["_update_penalty"] = {
                "applied": True,
                "penalty_points": penalty,
                "reason": "negative_signals_in_latest_comment",
                "latest_comment_excerpt": latest_update_text[:280],
            }
            if isinstance(explainability.get("_scoring"), dict):
                explainability["_scoring"]["final_probability"] = score
        anchor_line = f"Последнее изменение: {latest_update_text[:220]}"
        if anchor_line.lower() not in summary.lower():
            summary = f"{anchor_line}. {summary}".strip()
    total_tokens = usage.get("total_tokens", 0) if isinstance(usage, dict) else 0
    try:
        total_tokens = float(total_tokens or 0)
    except Exception:
        total_tokens = 0

    ai_record = _tenant_api_create(
        tenant_pb_url,
        "ai_insights",
        {
            "deal_id": deal_id,
            "score": score,
            "summary": summary,
            "suggestions": suggestions,
            "risks": risks_value,
            "explainability": explainability,
            "model": f"{used_provider}:{used_engine}",
            "token_usage": total_tokens,
            "created_by": user_id or None,
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
        admin_token,
    )

    mode_label = "обновление контекста" if is_update_mode else "полный срез"
    action_by_task = {
        "deal_analysis": "ai_update_analysis" if is_update_mode else "ai_analysis",
        "decision_support": "ai_decision_support",
        "client_enrichment": "ai_client_enrichment",
        "competitor_strategy": "ai_competitor_strategy",
        "client_research": "ai_client_research",
        "semantic_enrichment": "ai_semantic_enrichment",
        "tender_tz_analysis": "ai_tz_analysis",
    }
    timeline_text = f"AI-анализ обновлен ({mode_label}). Score: {score}/100.\nРезюме: {summary}\nРекомендации: {suggestions}"
    if task_code == "client_research":
        timeline_text = (
            f"AI-исследование клиента завершено ({mode_label}). Score: {score}/100.\n"
            f"Кратко: {summary[:700] if summary else 'См. полный отчет в файлах сделки.'}"
        )
    _tenant_api_create(
        tenant_pb_url,
        "timeline",
        {
            "deal_id": deal_id,
            "user_id": user_id or None,
            "action": action_by_task.get(task_code, "ai_analysis"),
            "comment": timeline_text,
            "payload": {
                "provider": used_provider,
                "engine": used_engine,
                "insight_id": ai_record.get("id", ""),
                "analysis_mode": "update" if is_update_mode else "full",
                "requested_task_code": task_code,
                "company_id": company_id,
                "product_id": product_id,
            },
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
    price_per_1k = float(((routing.get("budget", {}) or {}).get("default_price_rub_per_1k_tokens", 0.0) or 0.0))
    total_cost_rub = (float(total_tokens or 0) / 1000.0) * price_per_1k
    _append_ai_usage_monthly(tenant_code, usage, total_cost_rub)
    structured_ok = _llm_result_has_structured_payload(llm_result)
    fallback_used = used_provider != primary_provider or used_engine != primary_engine
    quality_gate = _quality_gate_check(tenant_pb_url, fallback_used, structured_ok)
    if quality_gate.get("alert"):
        _audit_log(
            "ai_quality_alert",
            {
                "deal_id": deal_id,
                "tenant_pb_url": tenant_pb_url,
                "provider_used": f"{used_provider}:{used_engine}",
                "primary": f"{primary_provider}:{primary_engine}",
                "fallback_used": fallback_used,
                "structured_ok": structured_ok,
                "quality_gate": quality_gate,
                "data_policy_version": data_policy.get("version", "v1"),
            },
        )
    _audit_log(
        "analyze_success",
        {
            "deal_id": deal_id,
            "provider": used_provider,
            "engine": used_engine,
            "provider_used": f"{used_provider}:{used_engine}",
            "fallback_used": fallback_used,
            "structured_ok": structured_ok,
            "quality_gate": quality_gate,
            "data_policy_version": data_policy.get("version", "v1"),
            "score": score,
            "llm_score_raw": llm_score,
            "summary": summary,
            "suggestions": suggestions,
            "token_usage": total_tokens,
            "insight_id": ai_record.get("id", ""),
        },
    )
    return {
        "ok": True,
        "score": score,
        "summary": summary,
        "suggestions": suggestions,
        "provider": used_provider,
        "engine": used_engine,
    }


def _run_ai_deal_analysis_background(payload):
    try:
        result = run_ai_deal_analysis(payload)
        _audit_log(
            "analyze_async_done",
            {
                "deal_id": str(payload.get("deal_id", "")),
                "task_code": str(payload.get("task_code", "")),
                "ok": bool(result.get("ok")),
                "error": str(result.get("error", "")) if isinstance(result, dict) else "",
            },
        )
    except Exception as e:
        _audit_log(
            "analyze_async_exception",
            {
                "deal_id": str(payload.get("deal_id", "")),
                "task_code": str(payload.get("task_code", "")),
                "error": str(e),
            },
        )


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
                "max_output_tokens": 2800,
            },
            "decision_support": {
                "primary_provider": "qwen",
                "primary_engine": "qwen3-coder",
                "fallback_provider": "deepseek",
                "fallback_engine": "v3",
                "token_provider": "",
                "max_requests_per_day": 10,
                "max_output_tokens": 900,
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
            "client_research": {
                "primary_provider": "or_deepseek",
                "primary_engine": "deepseek/deepseek-r1",
                "fallback_provider": "or_qwen",
                "fallback_engine": "qwen/qwen3-235b-a22b",
                "token_provider": "",
                "max_requests_per_day": 3,
                "max_output_tokens": 5200,
            },
            "semantic_enrichment": {
                "primary_provider": "qwen",
                "primary_engine": "qwen3-coder",
                "fallback_provider": "deepseek",
                "fallback_engine": "v3",
                "token_provider": "",
                "max_requests_per_day": 120,
                "max_output_tokens": 1200,
            },
            "tender_tz_analysis": {
                "primary_provider": "deepseek",
                "primary_engine": "v3",
                "fallback_provider": "qwen",
                "fallback_engine": "qwen3.6-plus",
                "token_provider": "",
                "max_requests_per_day": 20,
                "max_output_tokens": 2800,
            },
        },
        "budget": {
            "default_price_rub_per_1k_tokens": 0.1,
        },
        "prompts": {
            "deal_analysis": (
                "Ты AI-ассистент CRM по B2B продажам. Проанализируй контекст сделки и верни один валидный JSON "
                "без markdown с гибкой структурой разделов (4, 9, 20+ — сколько нужно по задаче). "
                "Желательно включать score (0..100), summary, suggestions/recommendations и risks. "
                "Учитывай историю коммуникации, динамику событий и обязательства клиента. "
                "Summary и рекомендации — только конкретика из данных CRM: имена, суммы, даты, конкуренты, этап; "
                "без воды и без шаблонов вроде «следует улучшить взаимодействие»."
            ),
            "decision_support": (
                "Ты AI-помощник менеджера продаж. Сформируй практический совет перед следующим действием: "
                "кому писать/звонить, каким тоном, какие аргументы и какой следующий шаг выбрать."
            ),
            "client_enrichment": (
                "Ты AI для обогащения контекста клиента из открытых источников и CRM данных. "
                "Верни факты, гипотезы, риски, ЛПР/ЛВР, подтвержденные боли."
            ),
            "competitor_strategy": (
                "Ты AI по конкурентной стратегии. Сформируй план, как выиграть против конкурентов "
                "в текущей сделке и какие контраргументы использовать."
            ),
            "client_research": (
                "Ты AI-исследователь клиента по выбранному продукту. Верни структурированное досье: "
                "бизнес-контекст, боли, зрелость, ключевые лица, ограничения и тактику входа."
            ),
            "semantic_enrichment": (
                "Ты AI для дешевого семантического расширения. На входе ключевые слова, конкуренты и сущности CRM. "
                "Верни только список вариаций, синонимов и производных без воды."
            ),
            "tender_tz_analysis": (
                "Ты AI-аналитик ТЗ. Сравни ТЗ клиента и паспорт продукта, выдели fit/gap, критичные блокеры, "
                "вероятность проходимости и рекомендации по доработке КП."
            ),
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
    out = {"routes": {}, "budget": {}, "prompts": {}}
    for route_key, default_entry in default["routes"].items():
        route_raw = routes.get(route_key, {}) if isinstance(routes, dict) else {}
        merged = dict(default_entry)
        merged.update(_normalize_route_entry(route_raw))
        out["routes"][route_key] = merged

    out["budget"]["default_price_rub_per_1k_tokens"] = float(
        budget.get("default_price_rub_per_1k_tokens", default["budget"]["default_price_rub_per_1k_tokens"]) or 0
    )
    prompts = data.get("prompts", {}) if isinstance(data.get("prompts"), dict) else {}
    for prompt_key, prompt_default in default.get("prompts", {}).items():
        out["prompts"][prompt_key] = str(prompts.get(prompt_key, prompt_default))
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
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            if headers:
                for k, v in headers.items():
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            # Client closed connection while response was being sent.
            # Request may already be processed successfully; avoid noisy 500 fallback path.
            return

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
        if path == "/api/master-prompt":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                self._json(200, {"master_prompts": _get_master_prompts()})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/ai-data-policy":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                self._json(200, {"policy": _get_ai_data_policy()})
            except Exception as e:
                self._json(500, {"error": str(e)})
            return
        if path == "/api/tenant-limits":
            if not self._require_auth():
                self._json(401, {"error": "unauthorized"})
                return
            try:
                qs = parse_qs(parsed.query)
                tenant_code = str((qs.get("tenant_code", [""])[0] or "")).strip()
                self._json(200, _get_tenant_limit_override(tenant_code))
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
                if not _check_login_rate(username):
                    self._json(429, {"error": "too many login attempts, try later"})
                    return
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
                        "Set-Cookie": f"fc_session={token}; Path=/owner/; HttpOnly; Secure; SameSite=Lax; Max-Age={SESSION_TTL_HOURS*3600}",
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
                    headers={"Set-Cookie": "fc_session=; Path=/owner/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"},
                )
                return
            if path == "/api/public/ai/analyze-deal":
                origin = self.headers.get("Origin", "")
                if not _origin_allowed(origin):
                    self._send(403, json.dumps({"ok": False, "error": "forbidden origin"}), "application/json; charset=utf-8")
                    return
                payload["tenant_user_token"] = self.headers.get("Authorization", "")
                task_code = str(payload.get("task_code", "deal_analysis")).strip() or "deal_analysis"
                if task_code == "client_research":
                    # Client research can run 5-15+ minutes with deep-research models.
                    # Run asynchronously to avoid browser/proxy timeouts ("Failed to fetch").
                    job_id = "job_" + secrets.token_hex(8)
                    payload["job_id"] = job_id
                    t = threading.Thread(target=_run_ai_deal_analysis_background, args=(dict(payload),), daemon=True)
                    t.start()
                    self._send(
                        200,
                        json.dumps(
                            {
                                "ok": True,
                                "accepted": True,
                                "job_id": job_id,
                                "task_code": task_code,
                                "message": "client_research started in background",
                            },
                            ensure_ascii=False,
                        ),
                        "application/json; charset=utf-8",
                        headers=self._public_headers(origin),
                    )
                    return
                try:
                    result = run_ai_deal_analysis(payload)
                except Exception as e:
                    _audit_log(
                        "analyze_exception",
                        {
                            "deal_id": payload.get("deal_id", ""),
                            "tenant_pb_url": payload.get("tenant_pb_url", ""),
                            "error": str(e),
                        },
                    )
                    result = {"ok": False, "error": f"internal gateway error: {e}"}
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
            if path == "/api/master-prompt":
                if isinstance(payload, dict) and "master_prompt" in payload and len(payload.keys()) == 1:
                    self._json(200, _save_master_prompts({"deal_analysis": payload.get("master_prompt", "")}))
                else:
                    self._json(200, _save_master_prompts(payload if isinstance(payload, dict) else {}))
                return
            if path == "/api/ai-data-policy":
                policy = payload.get("policy", payload if isinstance(payload, dict) else {})
                self._json(200, _save_ai_data_policy(policy if isinstance(policy, dict) else {}))
                return
            if path == "/api/tenant-limits":
                self._json(200, _save_tenant_limit_override(payload if isinstance(payload, dict) else {}))
                return
            self._send(404, "not found")
        except Exception as e:
            if self._is_public_api_path(path):
                origin = self.headers.get("Origin", "")
                self._send(
                    500,
                    json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False),
                    "application/json; charset=utf-8",
                    headers=self._public_headers(origin),
                )
                return
            self._json(500, {"error": str(e)})


def main():
    missing = []
    if not OWNER_PASSWORD:
        missing.append("PLATFORM_CONSOLE_PASSWORD")
    if not TENANT_PB_ADMIN_EMAIL:
        missing.append("TENANT_PB_ADMIN_EMAIL")
    if not TENANT_PB_ADMIN_PASSWORD:
        missing.append("TENANT_PB_ADMIN_PASSWORD")
    if missing:
        raise RuntimeError("Missing required env vars: " + ", ".join(missing))
    httpd = HTTPServer((HOST, PORT), Handler)
    print(f"Founder console running on http://{HOST}:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

