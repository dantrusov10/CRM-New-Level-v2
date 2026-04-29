# DATABASE AS IS (PocketBase)

Источник фактов: `backend/pocketbase/collections.json` + `pb_schema.json` + `pb_import_*.json` + `pb_tasks_patch.json`.

## 1) Список найденных коллекций

### В основной схеме `collections.json`
`users`, `companies`, `settings_funnel_stages`, `settings_channels`, `settings_fields`, `settings_roles`, `deals`, `timeline`, `audit_log`, `role_maps`, `role_map_items`, `semantic_packs`, `ai_insights`, `parser_sources_media`, `parser_sources_tender`, `settings_media_parser`, `settings_media_parser_sources`, `settings_tender_parser`, `settings_tender_parser_platforms`, `settings_contact_parser`, `parser_runs`, `media_items`, `tender_items`, `tender_detail_requests`, `files`, `entity_files`, `tender_documents`, `contacts_found`, `kp_settings`, `price_lists`, `price_list_items`, `products`, `product_materials`, `quotes`, `quote_items`, `saved_filters`, `import_jobs`.

### Дополнительно в patch
`tasks`.

### Упоминаются в коде/требованиях, но отсутствуют в основной схеме
`deal_field_values`, `company_field_values`, `kp_instances`, `kp_documents`, `dashboard_cache`, `dashboard_presets`, `dashboard_views`, `kp_instances`/`settings_kp_templates` (фронт использует, но в `collections.json` не найдены).

---

## 2) Группировка по зонам

- CRM-core: `users`, `companies`, `deals`, `timeline`, `saved_filters`.
- AI: `ai_insights`, `semantic_packs`.
- Парсеры: `parser_runs`, `contacts_found`, `media_items`, `tender_items`, `tender_documents`, `tender_detail_requests`, `settings_*_parser`, `parser_sources_*`, `role_maps`, `role_map_items`.
- КП/коммерция: `kp_settings`, `price_lists`, `price_list_items`, `products`, `product_materials`, `quotes`, `quote_items`.
- Файлы: `files`, `entity_files`.
- Импорт: `import_jobs`.
- Аудит/админ: `audit_log`, `settings_roles`, `settings_fields`, `settings_channels`, `settings_funnel_stages`.
- Задачи: `tasks`.

---

## 3) Подробно по ключевым коллекциям

## `users` (auth)
- Назначение: учетные записи и роль доступа.
- Ключевые поля: `role`, `full_name`, `phone`, `is_active`, `last_login_at`, `failed_login_count`, `locked_until`.
- Доступ: в основной схеме управление фактически только admin-rule.
- Связи: `responsible_id` в `companies`/`deals`, `created_by` в ряде коллекций.

## `companies`
- Назначение: карточки компаний.
- Ключевые поля: `name`, `responsible_id`, `inn`, `phone`, `email`, `city`, `website`, `address`, `legal_entity`.
- Доступ: admin + owner-based rule через `responsible_id`.
- Связи: `deals.company_id`, `contacts_found.company_id`, `media_items.company_id`, `tender_items.company_id`.

## `deals`
- Назначение: центр продажного процесса.
- Ключевые поля: `title`, `company_id`, `responsible_id`, `stage_id`, бюджет/оборот/маржа/даты, `current_score`, `current_recommendations`.
- Доступ: admin + owner-based rule через `responsible_id`.
- Связи: `timeline`, `ai_insights`, `parser_runs`, `quotes`, `tasks`.

## `ai_insights`
- Назначение: результаты AI-анализа по сделке.
- Ключевые поля: `deal_id`, `summary`, `score`, `suggestions`, `risks`, `explainability`, `model`, `token_usage`, `trigger_event_id`, `created_by`, `created_at`.
- Доступ: admin + доступ ответственному сделки на чтение.
- Связи: `deal_id`, timeline события (логически).

## `audit_log`
- Назначение: системный аудит изменений.
- Ключевые поля: `actor_user_id`, `entity_type`, `entity_id`, `action`, `before`, `after`, `ip`, `user_agent`, `created_at`.
- Доступ: admin-only.

## `deal_field_values`
- Статус: **не найдено** в основных схемах текущего репозитория.
- Комментарий: для динамических полей вероятно используется другой механизм (`settings_fields` + прямые поля/JSON), требуется проверка production.

## `company_field_values`
- Статус: **не найдено**.

## `parser_runs`
- Назначение: запуск и статус parser job.
- Ключевые поля: `deal_id`, `run_type`, `parsers`, `status`, `started_at`, `finished_at`, `initiated_by`, `error`, `metrics`.
- Доступ: admin-only (по rules основной схемы).

## `contacts_found`
- Назначение: найденные контакты ЛПР/ЛВР.
- Ключевые поля: `deal_id`, `company_id`, `parser_run_id`, `role_map_item_id`, `position`, `influence_type`, `full_name`, `phone`, `telegram`, `email`, `source_url`, `source_type`, `confidence`, `is_verified`.
- Доступ: чтение owner/admin, запись admin (AS IS rules).

## `media_items`
- Назначение: медиа-сигналы по клиенту/сделке.
- Ключевые поля: `deal_id`, `company_id`, `parser_run_id`, `source_id`, `url`, `title`, `snippet`, `published_at`, `ai_relevance`, `ai_impact`, `ai_reason`, `raw_payload`.

## `files`
- Назначение: реестр файлов/ссылок.
- Ключевые поля: `storage_provider`, `bucket`, `path`, `filename`, `mime`, `size_bytes`, `checksum`, `uploaded_by`.
- Связи: `entity_files.file_id`.

## `entity_files`
- Назначение: привязка файлов к сущностям.
- Ключевые поля: `entity_type`, `entity_id`, `file_id`, `tag`, `created_at`.

## `import_jobs`
- Назначение: задания импорта.
- Ключевые поля: `entity_type`, `file_id`, `mapping_json`, `status`, `created_by`, `created_at`, `finished_at`, `error_log`.

## `products`
- Назначение: каталог продуктов.
- Ключевые поля: `name`, `segment`, `target_customer_segments`, `description`, `battle_card`.

## `price_lists`
- Назначение: загруженные прайс-листы.
- Ключевые поля: `name`, `file_id`, `schema_version`, `valid_from`, `valid_to`, `uploaded_by`.

## `quote_items`
- Назначение: позиции коммерческого предложения.
- Ключевые поля: `quote_id`, `sku`, `name`, `qty`, `unit_price`, `discount_percent`, `vat_percent`, `total`.
- Связь: `quotes`.

## `kp_instances`
- Статус: **не найдено** в `collections.json`, но используется во фронте (`DealKpModule`).
- Риск: потенциальная runtime-ошибка на окружениях без этой коллекции.

## `kp_documents`
- Статус: **не найдено**.

## `dashboard_cache`
- Статус: **не найдено**.

## `dashboard_presets`
- Статус: **не найдено**.

## `dashboard_views`
- Статус: **не найдено**.

---

## 4) Связи (основные)
- `deals.company_id -> companies.id`
- `deals.responsible_id -> users.id`
- `deals.stage_id -> settings_funnel_stages.id`
- `timeline.deal_id -> deals.id`
- `timeline.user_id -> users.id`
- `ai_insights.deal_id -> deals.id`
- `contacts_found.parser_run_id -> parser_runs.id`
- `entity_files.file_id -> files.id`
- `quotes.deal_id -> deals.id`
- `quote_items.quote_id -> quotes.id`
- `tender_documents.tender_id -> tender_items.id`

---

## 5) Правила доступа (AS IS, high-level)
- Core сделки/компании: owner-based + admin.
- Audit/часть admin-сущностей: admin-only.
- Saved filters: владелец фильтра.
- Files/entity_files: чтение шире, запись/удаление чаще admin-only (нужна валидация по бизнес-процессу).

---

## 6) Чего не хватает для полноценной SaaS-модели
- Единый и явный multi-tenant слой (`tenant_id` или физическая изоляция per tenant).
- Единые миграции схемы вместо нескольких конкурирующих JSON.
- Полный набор KPI/dashboard коллекций.
- Нормализованный контур КП-сущностей (расхождения схемы и UI).
- Полноценный биллинг/лимиты/usage-модель на уровне БД control plane.
