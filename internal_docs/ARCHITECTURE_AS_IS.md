# ARCHITECTURE AS IS

## Общая схема системы (фактическая)
- Web-приложение: `apps/web` (React + Vite + TypeScript + Tailwind).
- Data/API слой в текущем репо: PocketBase (`backend/pocketbase`).
- Схема БД хранится в JSON (`collections.json`, `pb_schema.json`, import-файлы).
- Отдельный AI gateway/control plane как код в этом репозитории отсутствует (есть только операционный контекст в `AGENT_CONTEXT.md`).

## Текстовая схема
Пользователь → Frontend → API/PocketBase → Collections  
Пользователь → Frontend → AI Gateway → LLM/Parsers → PocketBase  
Founder/Admin → Control Plane → Client Instances / Limits / Billing

> Вторая и третья строки в текущем репозитории представлены частично (по контрактам и документам), но не как полный исполняемый backend-контур.

## Frontend
- `react`, `react-router-dom`, `@tanstack/react-query`.
- PocketBase SDK в `apps/web/src/lib/pb.ts`.
- Роутинг в `apps/web/src/router.tsx`.
- Главные домены UI: dashboard, deals, companies, import/export, admin.
- KPI/КП модуль в `apps/web/src/ui/modules/kp`.

## Backend (AS IS в этом репо)
- PocketBase как BaaS-слой.
- Bash-скрипты:
  - `backend/pocketbase/init.sh` — импорт коллекций.
  - `backend/pocketbase/run.sh` — запуск сервера.
- Отдельного Node/Python backend в репозитории нет.

## PocketBase
- Источник коллекций: `backend/pocketbase/collections.json`.
- Также есть `pb_schema.json` и stage/import JSON (исторические или миграционные артефакты).
- Auth-коллекция `users`, base-коллекции для CRM/AI/парсеров/КП.

## Коллекции БД
См. `DATABASE_AS_IS.md` — там полный разбор с группировкой и правилами доступа.

## Auth / RBAC
- Аутентификация через PocketBase auth collection `users`.
- Роль хранится в `users.role` (в коде учтена legacy-совместимость с `role_name`).
- Матрица прав: `settings_roles` + frontend helper `can()` в `rbac.ts`.
- Rules в коллекциях дополнительно ограничивают доступ на уровне БД.

## API-взаимодействие
- Frontend работает напрямую с PocketBase API через SDK.
- Для local dev используется Vite proxy `/api -> http://127.0.0.1:8090`.
- Кастомный API gateway в этом репозитории не реализован как runtime.

## Где хранятся данные
- Данные PocketBase: `backend/pocketbase/pb_data`.
- Файлы и связи — через коллекции `files` и `entity_files`.
- Локальные UI-настройки (частично): `localStorage` (например, конфиг dashboard).

## Как frontend ходит в backend
- `PB_URL` берется из `VITE_PB_URL`, fallback `/api`.
- Все CRUD операции идут через `pb.collection(...).getList/getFullList/create/update/delete`.

## ENV-переменные (подтвержденные кодом)
- `VITE_PB_URL` — URL PocketBase API (или `/api` через proxy).
- Остальные переменные для gateway/control plane в этом репо напрямую не подтверждены как runtime-код.
- Для закрытого контура и ключей: `ENV_SECRET_REQUIRED`.

## Как устроен деплой
- По файлам видно поддержку деплоя frontend на Vercel (`vercel.json` в корне и в `apps/web`).
- PocketBase предполагается как отдельный runtime на VM/VPS.
- В README есть рекомендации по размещению в РФ-облаке.

## Что делает Vercel
- Деплой статического/SPA frontend.
- Не покрывает запуск PocketBase и не покрывает отдельный AI-gateway runtime.

## Что делает Selectel/VPS (по контексту проекта)
- Хостинг backend-контуров (PocketBase, потенциально AI gateway/control plane).
- Из `AGENT_CONTEXT.md` видно, что реальный gateway может жить вне этого репо.

## Где может жить PocketBase
- Локально для dev (`127.0.0.1:8090`).
- На отдельном VPS/VM в проде (домен и reverse-proxy зависят от инфраструктуры).

## Где предполагается AI Gateway
- Как отдельный сервис вне текущего runtime этого репо.
- Точка интеграции во фронте/данных: `ai_insights`, `timeline`, parser collections.

## Где предполагается Control Plane
- Отдельный контур для founder/admin операций (лимиты, маршрутизация AI, инстансы, биллинг).
- В текущем репозитории есть лишь следы/описания, но не полный код control plane.

## Shared vs Dedicated VPS (архитектурное различие)
- Shared: один backend-контур, логическое разделение данных (tenant-aware правила/идентификаторы).
- Dedicated VPS: отдельная инфраструктура на клиента (выше изоляция, выше стоимость).
- В текущей схеме коллекций явного `tenant_id` почти нет — это важный архитектурный риск для shared SaaS.

## Как создается новая БД/инстанс под клиента (AS IS + допущения)
- Минимум: поднять новый PocketBase, импортировать `collections.json`, создать admin.
- Для SaaS-модели нужен явный provisioning-процесс (автоматизация), в коде этого репо не реализован.

## Риски текущей архитектуры
- Несколько источников правды по схеме (`collections.json`, `pb_schema.json`, `pb_import_*`).
- Расхождения фронта и схемы (например, `kp_instances`, `settings_kp_templates` используются в UI, но не в основной схеме).
- Отсутствие явного tenant-контроля для shared SaaS.
- Ограниченный observability-контур в репо (нет встроенного runtime-gateway логирования).

## Что проверить руками
1. Какая схема загружена в production PocketBase фактически.
2. Какие коллекции действительно существуют в проде (особенно КП и dashboard-сущности).
3. Как в production устроены AI gateway и лимиты.
4. Как сделан backup/restore по данным и файлам.
5. Какие CORS/прокси/домены используются в рабочем окружении.
