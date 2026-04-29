import PocketBase from "pocketbase";
import { PB_URL } from "./env";

export const pb = new PocketBase(PB_URL);

// optional: keep auth in localStorage
pb.autoCancellation(false);

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  /** Role slug (admin/manager/viewer). In PocketBase stored as `role_name`. */
  role?: string;
  role_name?: string;
};

type AuthModelLike = Partial<AuthUser> & { id?: string; email?: string; role?: string; role_name?: string };

export function getAuthUser(): AuthUser | null {
  const m = pb.authStore.model as AuthModelLike | null;
  if (!pb.authStore.isValid || !m?.id || !m?.email) return null;
  // In PB v0.22 our auth collection stores role as `role_name`.
  return {
    id: m.id,
    email: m.email,
    name: m.name ?? m.full_name,
    full_name: m.full_name,
    role: m.role_name ?? m.role,
    role_name: m.role_name,
  };
}
