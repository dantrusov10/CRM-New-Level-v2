import PocketBase from 'pocketbase';
import { PB_URL } from './env';
import type { UserSummary } from './types';
import { parseOne, userSummarySchema } from './schemas';

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

export function getAuthUser(): AuthUser | null {
  const raw = pb.authStore.model;
  if (!pb.authStore.isValid || !raw || typeof raw !== 'object') return null;
  const parsed = parseOne(userSummarySchema, raw) as UserSummary;
  if (!parsed.email) return null;
  return {
    id: parsed.id,
    email: parsed.email,
    name: parsed.name ?? parsed.full_name,
    role: parsed.role_name ?? parsed.role,
  };
}
