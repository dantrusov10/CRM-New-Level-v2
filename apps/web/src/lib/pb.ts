import PocketBase from "pocketbase";
import { PB_URL } from "./env";

export const pb = new PocketBase(PB_URL);

// optional: keep auth in localStorage
pb.autoCancellation(false);

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  /** Role slug (admin/manager/viewer). In PocketBase stored as `role_name`. */
  role?: string;
};

export function getAuthUser(): AuthUser | null {
  const m = pb.authStore.model as any;
  if (!pb.authStore.isValid || !m) return null;
  // In PB v0.22 our auth collection stores role as `role_name`.
  return { id: m.id, email: m.email, name: m.name, role: m.role_name ?? m.role };
}
