# Secrets for parser integrations

Do not store marketplace/platform tokens in PocketBase records.

Use server-side environment variables instead.

Example:

```bash
export NWLVL_TENDER_TOKENS_JSON='{"zakupki_gov":"TOKEN","b2b_center":"TOKEN"}'
```

Or create a local file that is not committed to git:

`backend/pocketbase/.secrets.local.json`

```json
{
  "tenderTokens": {
    "zakupki_gov": "TOKEN",
    "b2b_center": "TOKEN"
  }
}
```
