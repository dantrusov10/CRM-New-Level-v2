import type { KpInstanceStatus } from "./types";

export const KP_INSTANCE_STATUS_META: Record<
  KpInstanceStatus,
  { label: string; tone: "default" | "primary" | "success" | "warning" }
> = {
  draft: { label: "Черновик", tone: "default" },
  sent: { label: "Отправлено", tone: "primary" },
  final: { label: "Финал", tone: "success" },
};

export function normalizeInstanceStatus(s?: string): KpInstanceStatus {
  if (s === "sent" || s === "final") return s;
  return "draft";
}
