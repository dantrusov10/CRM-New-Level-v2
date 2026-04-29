# CODE STRUCTURE AS IS

## Корень репозитория
- `apps/web` — frontend.
- `backend/pocketbase` — схема и запуск PocketBase.
- `db/postgres/schema.sql` — альтернативная SQL-схема (future-proof).
- `db/pb_kp_patch.json` — patch-артефакт.
- `vercel.json` — SPA rewrite.
- `AGENT_CONTEXT.md` — операционный контекст.

## Frontend (`apps/web`)
- `src/main.tsx` — bootstrap.
- `src/router.tsx` — маршруты приложения.
- `src/lib/*` — SDK, env, типы, утилиты.
- `src/ui/components/*` — UI-компоненты.
- `src/ui/layout/*` — каркас приложения.
- `src/ui/data/hooks.ts` — React Query + PocketBase data hooks.
- `src/ui/pages/*` — страницы (dashboard/deals/companies/admin/import-export/calendar/login).
- `src/ui/modules/kp/*` — KPI/КП модуль и калькуляция.

## Где frontend
`apps/web/src`.

## Где backend
В этом репо backend-runtime как отдельное приложение отсутствует; есть PocketBase-контур в `backend/pocketbase`.

## Где PocketBase schema
- `backend/pocketbase/collections.json` (основной bootstrap).
- `backend/pocketbase/pb_schema.json` (export-like snapshot).
- `backend/pocketbase/pb_import_*.json` (stage/import артефакты).
- `backend/pocketbase/pb_tasks_patch.json`.

## Где config
- `apps/web/vite.config.ts`
- `apps/web/tailwind.config.js`
- `apps/web/postcss.config.js`
- `vercel.json`, `apps/web/vercel.json`

## Где стили
- `apps/web/src/index.css`

## Где компоненты
- `apps/web/src/ui/components`

## Где API-клиент
- `apps/web/src/lib/pb.ts`
- `apps/web/src/lib/env.ts`
- `apps/web/src/ui/data/hooks.ts`

## Где страницы
- `apps/web/src/ui/pages`

## Где бизнес-логика
- Hooks и page-модули:
  - `ui/data/hooks.ts`
  - `ui/pages/deals/*`
  - `ui/pages/admin/*`
  - `ui/modules/kp/*`

## Где моковые данные
- Явного отдельного каталога mock-данных не найдено.
- Часть fallback/демо-поведения вшита в frontend-логику.

## Где env
- В коде подтвержден `VITE_PB_URL`.
- `.env.example` в текущей рабочей копии не найден.

## Где деплой-конфиг
- `vercel.json` (корень и web-папка).
- Для PocketBase — shell-скрипты `backend/pocketbase/init.sh`, `run.sh`.

## Как быстро найти нужное место разработчику
- Проблемы с данными/CRUD: `ui/data/hooks.ts`.
- Проблемы авторизации/ролей: `lib/pb.ts`, `lib/rbac.ts`, `pages/admin/AdminUsersPage.tsx`.
- Проблемы pipeline: `pages/deals/DealsTablePage.tsx`, `DealsKanbanPage.tsx`, `DealDetailPage.tsx`.
- Проблемы КП: `ui/modules/kp/*`.
- Проблемы схемы БД: `backend/pocketbase/collections.json`.

## Особенности структуры, на которые обратить внимание
- Есть несколько schema-json, которые могут расходиться.
- Фронт использует некоторые коллекции, отсутствующие в основной `collections.json` (нужна синхронизация).
