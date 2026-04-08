#!/usr/bin/env node
// Minimal live RBAC smoke test for PocketBase.
// Usage:
// PB_URL=... PB_USER_A_EMAIL=... PB_USER_A_PASSWORD=... PB_USER_B_EMAIL=... PB_USER_B_PASSWORD=... node scripts/rbac-smoke-check.mjs
import PocketBase from 'pocketbase';

const required = ['PB_URL', 'PB_USER_A_EMAIL', 'PB_USER_A_PASSWORD', 'PB_USER_B_EMAIL', 'PB_USER_B_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

async function auth(email, password) {
  const pb = new PocketBase(process.env.PB_URL);
  await pb.collection('users').authWithPassword(email, password);
  return pb;
}

const pbA = await auth(process.env.PB_USER_A_EMAIL, process.env.PB_USER_A_PASSWORD);
const pbB = await auth(process.env.PB_USER_B_EMAIL, process.env.PB_USER_B_PASSWORD);

const meA = pbA.authStore.model;
const meB = pbB.authStore.model;

const company = await pbA.collection('companies').create({ name: `RBAC smoke ${Date.now()}`, responsible_id: meA.id });
const deal = await pbA.collection('deals').create({ title: `RBAC smoke deal ${Date.now()}`, company_id: company.id, responsible_id: meA.id });

let blocked = false;
try {
  await pbB.collection('deals').getOne(deal.id);
} catch {
  blocked = true;
}

console.log(JSON.stringify({
  createdCompanyId: company.id,
  createdDealId: deal.id,
  userA: meA?.id,
  userB: meB?.id,
  blocked,
}, null, 2));

if (!blocked) {
  console.error('RBAC FAILED: user B can access user A deal');
  process.exit(2);
}

console.log('RBAC smoke test passed');
