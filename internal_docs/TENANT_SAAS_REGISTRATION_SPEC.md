# Регистрация клиента → поддомен → отдельная БД → промпты по умолчанию (спецификация)

Цель: зафиксировать **архитектуру и контракты**, которые вы описали, чтобы реализация была согласованной между сайтом, control plane, tenant PocketBase, CRM UI и AI gateway.

---

## 1. Принцип (кратко)

1. Клиент подал заявку с сайта → запись в **control DB** (флаг/статус вроде «зарегать» / `approved_for_provisioning`).
2. Оператор/фаундер ставит галочку → запускается **провиженинг**: создаётся tenant, выдаётся **личный поддомен** вида `{slug}.app.nwlvl.ru`, поднимается/привязывается **отдельный PocketBase** с **преднастроенными коллекциями** (экспорт эталона из репо: `backend/pocketbase/collections.json`).
3. Эта БД **учётно подчинена** control plane (как и остальные): в control хранится `tenant_code`, URL PB, статус, лимиты, домены.
4. В tenant БД **заливаются дефолтные промпты и маршрутизация** из ЛК фаундера ([control.nwlvl.ru/owner/](https://control.nwlvl.ru/owner/)): то, что сейчас задаётся как routing + prompts + master prompts, должно **материализоваться** в tenant-данных (см. §4).
5. В **ЛК клиента** (CRM → админ → «Парсеры и AI») эти же тексты **отображаются** с пометкой: «значения по умолчанию с control; можно редактировать».
6. **Инвариант безопасности по времени:** независимо от того, клиент правил промпт или нет, **AI gateway** перед каждым вызовом LLM **всегда** добавляет блок дат (`request_instant_utc` + хронология с датами). Это уже реализовано в `platform-console` (`run_ai_deal_analysis`); при копировании gateway на новый VPS правило должно сохраняться (см. `AI_DATE_CONTEXT_CONTRACT.md`).

---

## 2. Поток данных (уровни)

| Этап | Где хранится | Что происходит |
|------|----------------|----------------|
| Заявка с сайта | Control DB (`tenant_registrations` или расширение `tenants`) | email, company, желаемый slug, статус `pending` |
| Одобрение | Control DB | статус → `approved`, очередь `provision_job_id` |
| Провиженинг | Control + инфра | DNS/ingress `{slug}.app.nwlvl.ru` → tenant PB; запись `tenant_instances` |
| Схема PB | Tenant PB | `pb migrate` / import из эталона репозитория |
| Промпты по умолчанию | Control → Tenant | одноразовый **seed** в tenant (см. §4) |
| Редактирование | Tenant только | клиент меняет тексты; control не перетирает без политики «reset to default» |
| Вызов ИИ | Gateway | tenant prompt + **всегда** date envelope |

---

## 3. Поддомен и маршрутизация

- Шаблон: `{tenant_slug}.app.nwlvl.ru` (или согласованный wildcard `*.app.nwlvl.ru`).
- **Vercel** (если фронт там): добавить wildcard host / отдельный проект для app-поддомена, либо **nginx** на edge с `server_name *.app.nwlvl.ru` и прокси на нужный PB/статик.
- CRM фронт: `VITE_PB_URL` / конфиг домена должен резолвиться из host (уже распространённый паттерн: `window.location.origin` → `/api` или полный PB URL per tenant).

---

## 4. Где хранить «промпты клиента» vs «дефолт из founder»

Сейчас gateway читает tenant-промпт через `semantic_packs` с фильтром вида `type="deal" && model="deal_analysis_prompt"` (см. `server.py` / `_get_tenant_prompt`). Варианты реализации пометки «дефолт / отредактировано»:

**Рекомендуемый минимальный путь (без ломки существующих правил PB):**

- Добавить в `semantic_packs` (или выделенную коллекцию `settings_ai_prompts`) поля:
  - `scenario_key` — строка: `deal_analysis`, `client_research`, `decision_support`, …
  - `prompt_body` — текст
  - `origin` — `founder_default` | `tenant_edited`
  - `founder_version` / `synced_at` — для будущих обновлений шаблонов из control

**Сид при провиженинге:**

1. Прочитать из control SQLite текущий `routing_matrix.prompts` + `master_prompts` (как в ЛК).
2. Создать в tenant по одной записи на сценарий с `origin=founder_default`.
3. Gateway при сборке промпта: сначала tenant override (`origin=tenant_edited` или последняя версия), иначе `founder_default`.

Пока сид можно упростить: копировать только то, что уже читает `_get_tenant_prompt` (deal_analysis_prompt и др.), постепенно расширяя.

---

## 5. UI в ЛК клиента (CRM)

- Раздел: **Админ → Парсеры и AI** (`AdminParsersPage.tsx` и/или новая вкладка «Промпты ИИ»).
- Для каждого сценария: textarea + badge «По умолчанию с control» / «Изменено вами» + кнопка «Сбросить к дефолту» (опционально).
- Редактирование пишет в tenant коллекцию; **gateway не доверяет** клиенту удалять date envelope — только тексты сценария.

---

## 6. Очередь и идемпотентность

- Провиженинг должен быть **идемпотентным**: повторный запуск не создаёт второй PB.
- Статусы: `pending` → `provisioning` → `active` | `failed` (с логом ошибки в control).

---

## 7. Связь с репозиторием

| Артефакт | Назначение |
|----------|------------|
| `backend/pocketbase/collections.json` | эталон схемы tenant |
| `internal_docs/CLIENT_ONBOARDING_AND_DB_CREATION.md` | операционный onboarding |
| `internal_docs/AI_DATE_CONTEXT_CONTRACT.md` | инвариант дат в gateway |
| Лендинг / форма заявки | вне этого репо (`newlevelcrm_landing`) — POST в control API или в общую очередь |

---

## 8. Следующие шаги реализации (код)

1. **Control plane**: таблица заявок + API «одобрить и поставить в очередь» + worker/cron `provision_tenant`.
2. **Скрипт провиженинга** (bash/python на сервере): создать `pb_data`, импорт коллекций, создать admin, записать в control `tenant_instances`.
3. **DNS / TLS** для `*.app.nwlvl.ru`.
4. **Seed промптов** из control routing → tenant `semantic_packs` / `settings_ai_prompts`.
5. **CRM UI**: экран редактирования + поля `origin`.
6. Регресс: убедиться, что **все** пути к LLM в gateway по-прежнему вызывают date envelope (уже для `run_ai_deal_analysis`).

Этот документ — **контракт**; по мере внедрения можно разбить на задачи в трекере и привязать к PR в соответствующих репозиториях.
