import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  variant = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} widthClass="max-w-md">
      <div className="text-sm text-text2 leading-relaxed">{message}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function AlertDialog({
  open,
  title,
  message,
  okLabel = "Понятно",
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  okLabel?: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} widthClass="max-w-md">
      <div className="text-sm text-text2 leading-relaxed">{message}</div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>{okLabel}</Button>
      </div>
    </Modal>
  );
}

export function PromptDialog({
  open,
  title,
  message,
  label,
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  return (
    <Modal open={open} title={title} onClose={onCancel} widthClass="max-w-md">
      {message ? <div className="text-sm text-text2 mb-3">{message}</div> : null}
      <label className="block text-xs text-text2 mb-1">{label}</label>
      <input
        className="w-full rounded-card border border-border bg-rowHover px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button onClick={() => onConfirm(value.trim())}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
