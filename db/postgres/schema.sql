-- CRM «Решение» — PostgreSQL schema (Variant B: Managed PostgreSQL + Object Storage)
-- Generated from functional spec: CRM core + AI orchestrator + media/tender/contact parsers + admin settings + КП calculator.
-- Notes:
-- 1) UUIDs: uses pgcrypto gen_random_uuid()
-- 2) Tokens/credentials must be stored encrypted at app level (or using pgcrypto PGP_SYM_ENCRYPT if desired).
-- 3) Large files are stored in Object Storage; DB stores metadata + links (files table).
-- 4) Times are stored as timestamptz.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================
-- 1) USERS / AUTH / RBAC
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  role            text NOT NULL,         -- 'admin' | 'manager' | 'viewer' (or custom)
  full_name       text,
  phone           text,
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

-- Role templates / permissions matrix
CREATE TABLE IF NOT EXISTS settings_roles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name            text NOT NULL UNIQUE,
  can_read_all         boolean NOT NULL DEFAULT false,
  can_edit_own         boolean NOT NULL DEFAULT true,
  can_edit_all         boolean NOT NULL DEFAULT false,
  can_manage_roles     boolean NOT NULL DEFAULT false,
  can_configure_fields boolean NOT NULL DEFAULT false,
  perms                jsonb NOT NULL DEFAULT '{}'::jsonb,  -- expanded matrix by sections
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- 2) CORE ENTITIES
-- =========================

CREATE TABLE IF NOT EXISTS companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  inn             text,
  legal_entity    text,
  responsible_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  phone           text,
  email           text,
  city            text,
  website         text,
  address         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_inn ON companies(inn);
CREATE INDEX IF NOT EXISTS idx_companies_responsible ON companies(responsible_id);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);

-- Funnel stages (normalized)
CREATE TABLE IF NOT EXISTS settings_funnel_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name    text NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  color         text,
  active        boolean NOT NULL DEFAULT true,
  is_final      boolean NOT NULL DEFAULT false,
  final_type    text NOT NULL DEFAULT 'none', -- 'won'|'lost'|'none'
  default_prob  numeric(5,4), -- 0..1 (optional)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_position ON settings_funnel_stages(position);
CREATE INDEX IF NOT EXISTS idx_stages_active ON settings_funnel_stages(active);

-- Sales channels
CREATE TABLE IF NOT EXISTS settings_channels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name  text NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Field constructor
CREATE TABLE IF NOT EXISTS settings_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection      text NOT NULL,          -- 'companies' | 'deals' | etc.
  field_name      text NOT NULL,
  label           text NOT NULL,
  field_type      text NOT NULL,          -- text/date/number/email/select/...
  visible         boolean NOT NULL DEFAULT true,
  required        boolean NOT NULL DEFAULT false,
  options         jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order      integer NOT NULL DEFAULT 0,
  role_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection, field_name)
);

CREATE INDEX IF NOT EXISTS idx_settings_fields_collection ON settings_fields(collection);
CREATE INDEX IF NOT EXISTS idx_settings_fields_sort_order ON settings_fields(collection, sort_order);

-- Deals (Deal ID = deals.id)
CREATE TABLE IF NOT EXISTS deals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   text NOT NULL,
  company_id              uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  responsible_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  stage_id                uuid REFERENCES settings_funnel_stages(id) ON DELETE SET NULL,

  budget                  numeric(18,2),
  turnover                numeric(18,2),
  margin_percent          numeric(6,3),
  discount_percent        numeric(6,3),

  sales_channel           text,            -- direct/partner
  partner                 text,
  distributor             text,
  purchase_format         text,

  activity_type           text,
  endpoints               integer,
  infrastructure_size     text,
  presale                 text,

  attraction_channel      text,
  attraction_date         date,

  registration_deadline   date,
  test_start              date,
  test_end                date,
  delivery_date           date,
  expected_payment_date   date,
  payment_received_date   date,

  project_map_link        text,
  kaiten_link             text,

  current_score           numeric(5,2),    -- cached probability (0..100)
  current_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_responsible ON deals(responsible_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_expected_payment ON deals(expected_payment_date);
CREATE INDEX IF NOT EXISTS idx_deals_title_trgm ON deals USING gin (title gin_trgm_ops);

-- =========================
-- 3) TIMELINE + AUDIT
-- =========================

CREATE TABLE IF NOT EXISTS timeline (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action  text NOT NULL,
  comment text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_deal_ts ON timeline(deal_id, ts DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  entity_type   text NOT NULL,          -- deal/company/settings/...
  entity_id     uuid,
  action        text NOT NULL,          -- create/update/delete/import/export/login
  before        jsonb,
  after         jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id, created_at DESC);

-- =========================
-- 4) AI INSIGHTS + SEMANTIC PACKS
-- =========================

CREATE TABLE IF NOT EXISTS ai_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  summary          text,
  score            numeric(5,2),
  suggestions      text,
  risks            jsonb NOT NULL DEFAULT '[]'::jsonb,
  explainability   jsonb NOT NULL DEFAULT '{}'::jsonb,
  model            text,
  token_usage      integer,
  trigger_event_id uuid REFERENCES timeline(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_deal_created ON ai_insights(deal_id, created_at DESC);

-- Role maps (admin-defined influence roles for contact parser)
CREATE TABLE IF NOT EXISTS role_maps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  segment    text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_map_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_map_id    uuid NOT NULL REFERENCES role_maps(id) ON DELETE CASCADE,
  position_title text NOT NULL,
  influence_type text NOT NULL,           -- lpr/lvr/blocker/influencer
  weight         numeric(6,4) NOT NULL DEFAULT 0.5,
  is_active      boolean NOT NULL DEFAULT true,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_map_items_map ON role_map_items(role_map_id);
CREATE INDEX IF NOT EXISTS idx_role_map_items_influence ON role_map_items(influence_type);

-- Semantic packs: generated variants for deals/companies/roles
CREATE TABLE IF NOT EXISTS semantic_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL,             -- deal/company/role
  deal_id     uuid REFERENCES deals(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  role_map_id uuid REFERENCES role_maps(id) ON DELETE CASCADE,
  base_text   text NOT NULL,
  variants    jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of strings
  language    text NOT NULL DEFAULT 'ru',
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type = 'deal' AND deal_id IS NOT NULL AND company_id IS NULL AND role_map_id IS NULL) OR
    (type = 'company' AND company_id IS NOT NULL AND deal_id IS NULL AND role_map_id IS NULL) OR
    (type = 'role' AND role_map_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_semantic_packs_type ON semantic_packs(type);
CREATE INDEX IF NOT EXISTS idx_semantic_packs_deal ON semantic_packs(deal_id);

-- =========================
-- 5) PARSER SETTINGS (ADMIN CONTROL)
-- =========================

-- Media sources whitelist
CREATE TABLE IF NOT EXISTS parser_sources_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  url         text,
  source_type text NOT NULL DEFAULT 'site', -- site/rss/api
  is_official boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Tender platforms whitelist
CREATE TABLE IF NOT EXISTS parser_sources_tender (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  base_url         text,
  integration_type text NOT NULL DEFAULT 'hybrid', -- api/scrape/hybrid
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Contact parser settings
CREATE TABLE IF NOT EXISTS settings_contact_parser (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled        boolean NOT NULL DEFAULT true,
  schedule_cron  text, -- e.g. "0 7,19 * * *"
  role_map_id    uuid REFERENCES role_maps(id) ON DELETE SET NULL,
  sources_policy text NOT NULL DEFAULT 'balanced', -- official_only/balanced
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Media parser settings
CREATE TABLE IF NOT EXISTS settings_media_parser (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled       boolean NOT NULL DEFAULT true,
  schedule_cron text,
  keywords      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Many-to-many: selected media sources
CREATE TABLE IF NOT EXISTS settings_media_parser_sources (
  settings_id uuid NOT NULL REFERENCES settings_media_parser(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES parser_sources_media(id) ON DELETE RESTRICT,
  PRIMARY KEY (settings_id, source_id)
);

-- Tender parser settings
CREATE TABLE IF NOT EXISTS settings_tender_parser (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled         boolean NOT NULL DEFAULT true,
  schedule_cron   text,
  keywords        jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform_tokens jsonb NOT NULL DEFAULT '{}'::jsonb, -- store encrypted at app level recommended
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Many-to-many: selected tender platforms
CREATE TABLE IF NOT EXISTS settings_tender_parser_platforms (
  settings_id uuid NOT NULL REFERENCES settings_tender_parser(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES parser_sources_tender(id) ON DELETE RESTRICT,
  PRIMARY KEY (settings_id, platform_id)
);

-- =========================
-- 6) PARSER RUNS + RESULTS
-- =========================

CREATE TABLE IF NOT EXISTS parser_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  run_type     text NOT NULL, -- manual_enrich_on_create | scheduled
  parsers      jsonb NOT NULL DEFAULT '[]'::jsonb, -- [media,tender,contacts]
  status       text NOT NULL DEFAULT 'queued',     -- queued/running/success/partial/failed
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  error        text,
  metrics      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_parser_runs_deal_started ON parser_runs(deal_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_parser_runs_status ON parser_runs(status);

-- Media items
CREATE TABLE IF NOT EXISTS media_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  parser_run_id   uuid REFERENCES parser_runs(id) ON DELETE SET NULL,
  matched_variant text,
  source_id       uuid REFERENCES parser_sources_media(id) ON DELETE SET NULL,
  url             text NOT NULL,
  title           text,
  snippet         text,
  published_at    timestamptz,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  ai_relevance    text NOT NULL DEFAULT 'unknown', -- unknown/relevant/irrelevant
  ai_impact       numeric(6,4),
  ai_reason       jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_items_url ON media_items(url);
CREATE INDEX IF NOT EXISTS idx_media_items_deal_fetched ON media_items(deal_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_items_relevance ON media_items(ai_relevance);

-- Tender items
CREATE TABLE IF NOT EXISTS tender_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id            uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  company_id         uuid REFERENCES companies(id) ON DELETE SET NULL,
  parser_run_id      uuid REFERENCES parser_runs(id) ON DELETE SET NULL,
  platform_id        uuid REFERENCES parser_sources_tender(id) ON DELETE SET NULL,
  tender_url         text NOT NULL,
  tender_external_id text,
  title              text,
  customer_name      text,
  price              numeric(18,2),
  currency           text,
  published_at       timestamptz,
  deadline_at        timestamptz,
  status             text,
  ai_relevance       text NOT NULL DEFAULT 'unknown',
  ai_impact          numeric(6,4),
  ai_reason          jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_items_platform_extid
  ON tender_items(platform_id, tender_external_id)
  WHERE tender_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tender_items_platform_url
  ON tender_items(platform_id, tender_url);

CREATE INDEX IF NOT EXISTS idx_tender_items_deal ON tender_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_tender_items_relevance ON tender_items(ai_relevance);

-- Tender detail requests (button: "download details")
CREATE TABLE IF NOT EXISTS tender_detail_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id    uuid NOT NULL REFERENCES tender_items(id) ON DELETE CASCADE,
  deal_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'queued', -- queued/running/success/failed
  requested_at timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  error        text
);

CREATE INDEX IF NOT EXISTS idx_tender_detail_requests_tender ON tender_detail_requests(tender_id, requested_at DESC);

-- =========================
-- 7) FILES (Object Storage metadata) + attachments
-- =========================

CREATE TABLE IF NOT EXISTS files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL DEFAULT 'yandex_object_storage',
  bucket           text,
  path             text NOT NULL,
  filename         text,
  mime             text,
  size_bytes       bigint,
  checksum         text,
  uploaded_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);

CREATE TABLE IF NOT EXISTS entity_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,  -- deal/company/tender/product/kp_template/...
  entity_id   uuid NOT NULL,
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_files_entity ON entity_files(entity_type, entity_id);

-- Tender documents (references files)
CREATE TABLE IF NOT EXISTS tender_documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id  uuid NOT NULL REFERENCES tender_items(id) ON DELETE CASCADE,
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_id    uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  doc_type   text NOT NULL, -- description/attachment/archive
  filename   text,
  mime       text,
  size_bytes bigint,
  checksum   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tender_documents_tender ON tender_documents(tender_id);

-- =========================
-- 8) CONTACTS (from open sources)
-- =========================

CREATE TABLE IF NOT EXISTS contacts_found (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  company_id       uuid REFERENCES companies(id) ON DELETE SET NULL,
  parser_run_id    uuid REFERENCES parser_runs(id) ON DELETE SET NULL,
  role_map_item_id uuid REFERENCES role_map_items(id) ON DELETE SET NULL,
  position         text,
  influence_type   text, -- lpr/lvr/blocker/influencer
  full_name        text,
  phone            text,
  telegram         text,
  email            text,
  source_url       text,
  source_type      text,
  confidence       numeric(6,4),
  is_verified      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_found_deal ON contacts_found(deal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_found_email ON contacts_found(email);
CREATE INDEX IF NOT EXISTS idx_contacts_found_phone ON contacts_found(phone);

-- =========================
-- 9) КП CALCULATOR / PRODUCTS / PRICES
-- =========================

CREATE TABLE IF NOT EXISTS kp_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_logo_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  disclaimer           text,
  currency             text NOT NULL DEFAULT 'RUB',
  vat_percent          numeric(6,3),
  template_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_lists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  file_id        uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  schema_version text,
  valid_from     date,
  valid_to       date,
  uploaded_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_lists_created ON price_lists(created_at DESC);

CREATE TABLE IF NOT EXISTS price_list_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  sku           text,
  product_name  text NOT NULL,
  unit          text,
  price         numeric(18,2) NOT NULL,
  currency      text NOT NULL DEFAULT 'RUB',
  vat_percent   numeric(6,3),
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_sku ON price_list_items(sku);

CREATE TABLE IF NOT EXISTS products (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  segment                 text,
  target_customer_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  description             text,
  battle_card             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS product_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_id       uuid REFERENCES files(id) ON DELETE SET NULL,
  material_type text NOT NULL, -- presentation/doc/pdf/link
  title         text,
  url           text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_materials_product ON product_materials(product_id);

-- Generated quotes (КП) by deal
CREATE TABLE IF NOT EXISTS quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id              uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  generated_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  kp_settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals              jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_id             uuid REFERENCES files(id) ON DELETE SET NULL, -- generated PDF/DOCX
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_deal_created ON quotes(deal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sku              text,
  name             text NOT NULL,
  qty              numeric(18,3) NOT NULL DEFAULT 1,
  unit_price       numeric(18,2) NOT NULL DEFAULT 0,
  discount_percent numeric(6,3),
  vat_percent      numeric(6,3),
  total            numeric(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- =========================
-- 10) SAVED FILTERS + IMPORT JOBS
-- =========================

CREATE TABLE IF NOT EXISTS saved_filters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- deal/company
  name        text NOT NULL,
  filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id, entity_type);

CREATE TABLE IF NOT EXISTS import_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL, -- deal/company/...
  file_id      uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'queued', -- queued/running/success/failed
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  error_log    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

COMMIT;
