import React from "react";
import { Check, X } from "lucide-react";

type InlineConfirmActionsProps = {
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  size?: "md" | "lg";
};

export function InlineConfirmActions({ onConfirm, onCancel, disabled, size = "lg" }: InlineConfirmActionsProps) {
  const buttonSize = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const iconSize = size === "lg" ? 17 : 15;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        className={`ui-btn inline-confirm-ok ${buttonSize} px-0`}
        title="Подтвердить изменение"
        onClick={onConfirm}
        disabled={disabled}
      >
        <Check size={iconSize} />
      </button>
      <button
        type="button"
        className={`ui-btn inline-confirm-cancel ${buttonSize} px-0`}
        title="Отменить изменение"
        onClick={onCancel}
        disabled={disabled}
      >
        <X size={iconSize} />
      </button>
    </div>
  );
}
