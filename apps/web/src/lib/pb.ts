import PocketBase from "pocketbase";
import { PB_URL } from "./env";

export const pb = new PocketBase(PB_URL);

// optional: keep auth in localStorage
pb.autoCancellation(false);

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string; // reference to settings_roles or legacy enum
};

export function getAuthUser(): AuthUser | null {
  const m = pb.authStore.model as any;
  if (!pb.authStore.isValid || !m) return null;
  return { id: m.id, email: m.email, name: m.name, role: m.role };
}
