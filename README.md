# CRM New Level v3

Единый production-репозиторий CRM-платформы NewLevel: frontend продукта, схема tenant PocketBase, platform control-plane и AI gateway для анализа сделок.

Документ описывает текущее рабочее решение "как есть" для эксплуатации, передачи и безопасного развития.

---

## 1) Что в системе уже работает

- Мульти-tenant CRM на PocketBase с сущностями продаж (компании, сделки, timeline, контакты, задачи, документы).
- Platform control-plane (`control.nwlvl.ru`) с owner-консолью и централизованным управлением AI.
- Публичный AI gateway endpoint для CRM-клиента: анализ сделки по полному контексту.
- Гибкий формат AI-ответа: 4/9/20+ секций без жесткой привязки UI к фиксированным полям.
- Запись AI-результата в tenant данные (`ai_insights`, `timeline`, `deals.current_score/current_recommendations`).
- Автодеплой frontend через Vercel из этого GitHub-репозитория.

---

## 2) Архитектура и контуры

### Продуктовые домены

- `app.nwlvl.ru` — frontend CRM (React/Vite).
- `control.nwlvl.ru` — platform control plane + owner console + AI gateway.
- `*.nwlvl.ru` / `pb.nwlvl.ru` — tenant PocketBase инстансы клиентов.
- `cms-api.nwlvl.ru` — отдельный CMS-контур (логически изолирован от tenant CRM данных).

### Логические слои

1. **Frontend CRM (`apps/web`)**
   - UI менеджера продаж.
   - Работа с tenant PocketBase API.
   - Кнопка запуска AI-анализа через platform gateway (`VITE_AI_GATEWAY_URL`).

2. **Tenant Data Layer (PocketBase per tenant)**
   - Операционные данные сделок.
   - История коммуникаций и AI-оценок.
   - Роли, права, пользовательские сущности и файлы.

3. **Control Plane (`/opt/pb-control`)**
   - Глобальная конфигурация AI-маршрутизации.
   - Секреты провайдеров (серверная зона).
   - Аудит вызовов gateway и usage/cost агрегации.

4. **AI Providers**
   - `gigachat` и OpenAI-compatible провайдеры (`deepseek`, `qwen`, `openai`, ...).
   - Выбор primary/fallback по routing matrix.

---

## 3) Структура репозитория

- `apps/web` — frontend CRM (React + TypeScript + Vite + Tailwind).
- `backend/pocketbase` — актуальная схема и артефакты PocketBase.
- `backend/platform-console` — owner web-console и AI gateway (`server.py`).
- `db/postgres` — альтернативная SQL-модель (future path / аналитика).
- `vercel.json` и `apps/web/vercel.json` — SPA rewrites для Vercel.

---

## 4) Структура данных (ключевые коллекции)

Ниже рабочий минимум по сущностям, используемым в текущих бизнес-потоках.

### Бизнес-объекты CRM

- `companies`  
  Профиль компании: `name`, `inn`, контакты, адрес, ответственный.

- `deals`  
  Сделка: название, связь с компанией/этапом/ответственным, бюджетные и коммерческие поля, даты воронки, ссылки, текущий AI score/recommendations.

- `funnel_stages`  
  Этапы воронки: позиция, цвет, финальный тип (`won/lost/none`), дефолтная вероятность.

- `timeline`  
  Хронология событий по сделке: `action`, `comment`, `payload`, `timestamp`, `user_id`.
  Важные `action` в текущем UX: `comment`, `note`, `stage_change`, `task_created`, `workspace_link`, `ai_analysis`.

- `tasks`  
  Напоминания/задачи менеджера: `title`, `due_at`, `is_done`, связь с `deal_id/company_id`.

- `contacts_found`  
  Контакты из парсеров и ручного ввода: роль влияния, должность, каналы связи, confidence, верификация.

- `entity_files`  
  Привязка файлов к сущности (`entity_type/entity_id`), в сделках используется для workspace/документов.

### AI-коллекции

- `ai_insights`  
  Результат AI-анализа по сделке:
  - `score`
  - `summary`
  - `suggestions`
  - `risks` (json)
  - `explainability` (json, полный структурный ответ)
  - `model`, `token_usage`, `created_by`, `created_at`

### Платформенные control-данные

- `system_settings`  
  Хранение глобальных конфигов. Для AI ключевой ключ: `ai.routing.matrix`.

- `tenant_modules`  
  Feature/module toggles для конкретных tenant.

- `ai_usage_monthly` / `ai_usage_daily`  
  Агрегация usage/cost по tenant и периоду.

> Источник типизации frontend: `apps/web/src/lib/types.ts`  
> Базовая схема PB: `backend/pocketbase/collections.json` / `pb_schema.json`

---

## 5) AI-анализ сделки: как работает end-to-end

### Запуск

1. Менеджер нажимает "Запустить AI-анализ" в `DealDetailPage`.
2. Frontend вызывает `analyzeDealWithAi()` -> `POST {VITE_AI_GATEWAY_URL}/ai/analyze-deal`.
3. В запросе передается:
   - `deal_id`
   - `tenant_pb_url`
   - `tenant_user_token` (в Authorization)
   - `task_code` (`deal_analysis`)
   - `context` (frontend snapshot полей сделки)

### На gateway (`backend/platform-console/server.py`)

1. Валидация токена пользователя tenant + rate limit.
2. Получение routing matrix (`ai.routing.matrix`) и выбор primary/fallback провайдера.
3. Сбор полного контекста `_build_ai_context()`:
   - `deal_record` (с expand компании/этапа/ответственного),
   - `timeline_recent` (расширенный лимит),
   - `notes_recent`, `comments_recent`,
   - `ai_insights_recent`,
   - `contacts_found`,
   - `entity_files_deal`,
   - `frontend_context`.
4. Формирование промпта: tenant prompt (если есть) или owner/default prompt + JSON контекст + output rules.
5. Вызов провайдера, fallback при ошибке.
6. Нормализация ответа:
   - поддержка гибкого JSON (не только 4 поля),
   - извлечение `score/summary/suggestions/risks`,
   - сохранение полного payload в `explainability`.
7. Запись в tenant:
   - `ai_insights` (новая запись),
   - `timeline` (`ai_analysis` событие),
   - `deals.current_score/current_recommendations`.
8. Аудит в `AI_GATEWAY_AUDIT_LOG`.

### Quality-gate и диагностика качества

- В `analyze_success` пишутся маркеры:
  - `structured_ok` — удалось ли получить структурный payload от LLM.
  - `fallback_used` — использован ли fallback-движок.
  - `provider_used` — фактически использованный провайдер/движок.
  - `quality_gate` — статистика окна за 1 час.
- Если в скользящем окне 1 часа fallback используется слишком часто или структура ответа деградирует, пишется `ai_quality_alert`.
- Для отладки случаев `parsed={}` в `provider_attempt` добавляется `content_preview` (обрезанный фрагмент ответа).

### PII sanitizer перед LLM

- Перед отправкой контекста в модель применяется санитайзер:
  - email, телефоны, банковские/реквизитные номера, ИНН/КПП/БИК и похожие идентификаторы;
  - поля контактов/ФИО маскируются по key-based правилам.
- В аудит не пишется сырой frontend context: используется уже санитайзированная версия.
- Политика хранения:
  - хранить только маскированные данные в AI gateway audit;
  - не хранить полный prompt и не хранить raw PII в логах.

### На frontend

- AI-панель рендерит:
  - базовые блоки (`score`, `summary`, `suggestions`, `risks`),
  - дополнительные секции из `explainability`,
  - структурный рендер для JSON (объекты/массивы) вместо "сырой простыни".

---

## 6) Работа с сервером (production)

### Актуальное размещение control-plane

- Рабочая директория: `/opt/pb-control`
- Unit: `platform-console.service`
- Старт:
  - `ExecStart=/usr/bin/python3 /opt/pb-control/platform-console/server.py`
- Критичные env:
  - `CONTROL_DB_PATH`
  - `PLATFORM_CONSOLE_USER`
  - `PLATFORM_CONSOLE_PASSWORD`
  - `PLATFORM_AI_SECRETS_FILE`
  - `PUBLIC_AI_ALLOWED_ORIGINS`
  - `AI_GATEWAY_AUDIT_LOG`

Template unit в репозитории: `backend/platform-console/platform-console.service`

### Базовые команды эксплуатации

```bash
systemctl status platform-console.service
systemctl restart platform-console.service
journalctl -u platform-console.service -n 100 --no-pager
tail -n 100 /opt/pb-control/ai-gateway-audit.jsonl
```

### Важный нюанс деплоя backend

Vercel деплоит **только frontend**.  
`platform-console` обновляется отдельно (через git pull/scp/ansible + restart systemd).

---

## 7) Работа с прод-репозиторием GitHub

### Текущая модель

- Production source of truth: `main` в этом репозитории.
- Любые изменения для Vercel должны попасть в `main`.
- Для backend/gateway правки в git недостаточны: нужен серверный rollout.

### Рекомендуемый workflow

1. Изменения в feature-ветке.
2. PR и ревью.
3. Merge в `main`.
4. Frontend автодеплой (Vercel).
5. Backend rollout на сервер (systemd restart).
6. Smoke-check:
   - UI загружается;
   - `POST /owner/api/public/ai/analyze-deal` -> 200;
   - запись в `ai_insights` создается;
   - в audit log появляется `analyze_success` c `structured_ok/fallback_used/provider_used`.
   - нет свежих `ai_quality_alert` после smoke-run.

---

## 8) Автодеплой через Vercel

### Что настроено в репо

- SPA rewrites (`vercel.json`, `apps/web/vercel.json`) для роутинга React.

### Что должно быть настроено в Vercel Project

- Root directory: `apps/web`
- Build command: `npm run build`
- Output dir: `dist`
- Environment variables:
  - `VITE_PB_URL`
  - `VITE_AI_GATEWAY_URL` (обычно `https://control.nwlvl.ru/owner/api/public`)

### Нюансы

- Изменения UI видны после успешного build + release на Vercel.
- Изменения gateway не появляются от Vercel: это отдельный deployment track.

---

## 8.1) Аудит tenant-схемы (анти-404)

Для предотвращения падений контекста из-за отсутствующих коллекций/полей:

```bash
python backend/platform-console/audit_tenant_schema.py \
  --tenant https://pb.nwlvl.ru \
  --admin-email "$TENANT_PB_ADMIN_EMAIL" \
  --admin-password "$TENANT_PB_ADMIN_PASSWORD"
```

Или массово по env:

```bash
export TENANT_PB_URLS="https://pb1.nwlvl.ru,https://pb2.nwlvl.ru"
python backend/platform-console/audit_tenant_schema.py --from-env
```

Скрипт завершится кодом `1`, если найдены missing collections/fields.

---

## 9) Локальная разработка

### Frontend

```bash
cd apps/web
npm i
npm run dev
```

Windows PowerShell:

```powershell
cd apps/web
npm i
npm run dev
```

### PocketBase (локально)

```bash
cd backend/pocketbase
./init.sh
./run.sh
```

По умолчанию frontend может работать через `VITE_PB_URL=/api` и локальный proxy.

---

## 10) Безопасность и доступы

- Секреты AI-провайдеров хранятся только на сервере (`PLATFORM_AI_SECRETS_FILE`).
- Никогда не коммитить:
  - `.env` с токенами,
  - приватные SSH-ключи,
  - production credentials.
- Для founder-console обязательно сменить дефолтный пароль и вести ротацию.
- Для сервисных пользователей и деплой-ботов использовать минимально необходимые права.
- Формальный baseline по AI-данным: `SECURITY_BASELINE.md`.

---

## 11) Ответ на частый вопрос: можно ли сделать GitHub-репозиторий приватным?

Да, можно. Работа не ломается, если корректно настроить доступы:

1. **Vercel**
   - должен быть подключен к вашему GitHub аккаунту/организации с доступом к приватному репо;
   - после этого автодеплой из приватного репозитория работает штатно.

2. **Production сервер**
   - если сервер делает `git pull`, ему нужен deploy key или GitHub App token с read-доступом;
   - альтернатива: не тянуть с GitHub на сервере, а выкатывать артефакт через CI/CD.

3. **Работа через AI-ассистента в Cursor**
   - ассистент работает с локальным клоном, который открыт у вас в IDE;
   - если локальный git уже имеет доступ к приватному origin, ассистент продолжит коммитить/пушить как сейчас;
   - дополнительных "публичных" прав ассистенту не требуется.

Коротко: приватный репозиторий совместим и с Vercel, и с сервером, и с текущим процессом работы, если один раз правильно настроить доступы.

---

## 12) Runbook проверки после релиза

1. Открыть CRM и карточку сделки.
2. Запустить AI-анализ.
3. Проверить:
   - обновилась дата версии в AI-блоке;
   - появились/обновились данные в `ai_insights`;
   - в `timeline` есть `ai_analysis` событие;
   - в gateway audit log есть `analyze_request` -> `provider_attempt` -> `analyze_success`.
4. Если UI обновился, а смысл AI не изменился:
   - вероятнее всего не обновлен `platform-console`;
   - проверить unit и журнал сервиса.

---

## 13) Версионирование и релизы

- Основная ветка: `main`.
- Рекомендуемый формат релиза:
  1. Коммит/merge в `main`.
  2. Тег версии (`vX.Y.Z`).
  3. Release notes (что менялось в UI, gateway, данных, эксплуатации).

---

Если документ нужно превратить в "операционную вики" (с отдельными страницами по инцидентам, онбордингу инженера и SRE-чеклистами), лучше вынести в `docs/` и связать ссылками из этого README.
