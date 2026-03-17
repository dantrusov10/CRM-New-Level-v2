#!/usr/bin/env node
// Cleans legacy secrets from settings_tender_parser records.
// Usage:
// PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/cleanup-pb-secrets.mjs
import PocketBase from 'pocketbase';

for (const key of ['PB_URL', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD']) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

const pb = new PocketBase(process.env.PB_URL);
await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);

const rows = await pb.collection('settings_tender_parser').getFullList();
for (const row of rows) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(row, 'platform_tokens')) payload.platform_tokens = null;
  if (Object.keys(payload).length) {
    await pb.collection('settings_tender_parser').update(row.id, payload);
    console.log(`Cleaned secrets in settings_tender_parser/${row.id}`);
  }
}
console.log('Done');
