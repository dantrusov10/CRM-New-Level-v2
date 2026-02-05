import React from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export function Modal({
  open,
  title,
  children,
  onClose,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className={clsx("w-full rounded-card border border-border bg-card", widthClass)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">{title}</div>
          <button className="p-2 rounded-card hover:bg-rowHover" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
