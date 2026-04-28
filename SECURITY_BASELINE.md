# Security Baseline: AI Data Handling

This document defines the minimum security policy for sending CRM context to LLM providers.

## Scope

- Applies to `POST /api/public/ai/analyze-deal` in `backend/platform-console/server.py`.
- Covers outbound AI payloads, audit logs, and control-plane policy settings.

## Data Minimization Policy

- Default mode: `allow_all_except_deny`.
- Policy key in control DB: `ai.data_policy.v1`.
- Configurable policy fields:
  - `mode`: `allow_all_except_deny` or `allowlist`
  - `allow_key_patterns`: fields allowed in allowlist mode
  - `deny_key_patterns`: fields always redacted
  - `mask_key_patterns`: fields with forced masking
  - `redacted_placeholder`

## Mandatory Masking

Before LLM call, context is sanitized:

- email addresses
- phone numbers / messengers
- account-like identifiers (INN/KPP/BIK/account-like strings)
- contact/FIO-like fields
- secret-like fields (password/token/cookie/session/api_key/credential)

## Logging Rules

- `analyze_request` stores sanitized context only.
- `provider_attempt.parsed` is sanitized before writing to audit.
- `content_preview` is PII-sanitized and truncated.
- Raw full prompt is not persisted to audit logs.

## Quality and Safety Controls

- `structured_ok`, `fallback_used`, `provider_used` and `quality_gate` are logged in `analyze_success`.
- `ai_quality_alert` is emitted on degradation thresholds (high fallback ratio / low structured ratio).

## Retention and Access

- Audit file path: `AI_GATEWAY_AUDIT_LOG`.
- Access is restricted to server operators and founder/admin roles.
- Backup and cleanup windows are managed on the server side (ops policy).

## Validation Checklist

- AI request succeeds with sanitized output markers in audit.
- No raw PII appears in `analyze_request` or `provider_attempt.content_preview`.
- Policy endpoint works:
  - `GET /api/ai-data-policy`
  - `POST /api/ai-data-policy`

