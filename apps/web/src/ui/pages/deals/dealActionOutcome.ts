export type ActionOutcome = "success" | "failed" | "partial";

export const ACTION_OUTCOMES: ActionOutcome[] = ["success", "failed", "partial"];

export const OUTCOME_LABELS: Record<ActionOutcome, string> = {
  success: "Успешно",
  failed: "Не удачно",
  partial: "Частично",
};

export type AiActionTimelinePayload = {
  source?: string;
  ai_action_text?: string;
  outcome?: ActionOutcome;
  due_at?: string;
  manager_comment?: string;
  dismiss_reason?: string;
};
