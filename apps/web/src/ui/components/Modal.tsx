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
    <div
      // Intentionally keep the modal lower than the sticky header (so it never "hides" under it).
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 backdrop-blur-md px-4 pt-32 pb-8"
      onMouseDown={onClose}
    >
      <div
        className={clsx(
          "w-full rounded-card border border-border bg-[rgba(7,26,51,0.92)] max-h-[calc(100vh-140px)] overflow-hidden",
          widthClass
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">{title}</div>
          <button className="p-2 rounded-card hover:bg-rowHover" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px-56px)]">{children}</div>
      </div>
    </div>
  );
}
