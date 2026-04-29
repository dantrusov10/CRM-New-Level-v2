# GAPS AND TODO (AS IS)

## P0 — критично
- Синхронизировать фактическую схему с фронтом:
  - фронт использует `kp_instances` / `settings_kp_templates`,
  - в `collections.json` эти коллекции отсутствуют.
- Зафиксировать единый source of truth для схемы (сейчас есть `collections.json`, `pb_schema.json`, `pb_import_*`).
- Подтвердить production-схему и правила доступа.
- Внедрить строгий multi-tenant подход для shared SaaS (или явно отказаться от shared).
- Вынести и формализовать AI gateway runtime (контроль лимитов, policy, audit).

## P1 — важно
- Реализовать dashboard data-layer коллекции (`dashboard_cache`, `dashboard_presets`, `dashboard_views`) или убрать ожидания.
- Стандартизовать AI output schema и валидацию.
- Добавить usage/billing модель для AI (тенант/пользователь/период/стоимость).
- Усилить security контур:
  - redaction,
  - outbound policy,
  - secret governance.
- Добавить автоматические проверки schema drift.

## P2 — можно позже
- Улучшить DX документацию по миграциям и откатам.
- Сформировать единый каталог operational runbooks.
- Добавить расширенный мониторинг и отчеты по parser quality.

---

## Что уже сделано
- Рабочий frontend CRM (deals/companies/admin/import-export/dashboard).
- Базовая PocketBase schema.
- RBAC и owner-based access rules для ряда сущностей.
- Каркас AI data model (`ai_insights`) и parser контур.
- Каркас КП с расчетом и PDF.

## Что есть как документация, но не реализовано полностью в коде
- Полный founder-level control plane.
- End-to-end AI gateway/billing/tenant orchestration.
- Часть SaaS-механики (provisioning, lifecycle automation).

## Что есть как код, но слабо описано
- Парсерные настройки и карты ролей.
- КП-модуль и требования к связанным коллекциям.
- Расхождения между типами, hooks и schema snapshots.

## Что критично для MVP
- Стабильный CRUD по компаниям/сделкам.
- Корректные права доступа.
- Согласованная схема БД.
- Надежные timeline и файлы.

## Что критично для SaaS
- Tenant isolation.
- Provisioning и lifecycle клиентов.
- Billing и лимиты.
- Наблюдаемость и алертинг.

## Что критично для закрытого контура
- Data policy и redaction.
- Контроль outbound AI-вызовов.
- Управление секретами и аудит.
- Backup/restore и доступы.

## Что критично для тарификации
- Сбор usage по токенам/запросам.
- Привязка usage к tenant и тарифу.
- Политика превышения лимитов.

## Что критично для AI Gateway
- Единый runtime.
- Валидация structured output.
- Retry/fallback политика.
- Безопасный логинг.

## Что критично для безопасности
- Secret scanning.
- Role review.
- Минимизация данных в AI.
- Прозрачный аудит и инцидент-процедуры.

## Что можно отложить
- Расширенные product analytics.
- Deep BI и сложные dashboard cache механики.
- Нестандартные интеграции, пока не стабилизирован core.
