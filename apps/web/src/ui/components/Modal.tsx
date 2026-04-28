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
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/78 backdrop-blur-sm px-4 pt-32 pb-8"
      onMouseDown={onClose}
    >
      <div
        className={clsx(
          "w-full rounded-card border border-[rgba(51,215,255,0.45)] bg-[#0f2644] max-h-[calc(100vh-140px)] overflow-hidden shadow-[0_0_26px_rgba(51,215,255,0.2)]",
          widthClass
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(51,215,255,0.32)] bg-[rgba(45,123,255,0.14)]">
          <div className="text-sm font-semibold tracking-wide">{title}</div>
          <button className="p-2 rounded-card border border-[rgba(51,215,255,0.26)] hover:bg-rowHover" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px-56px)]">{children}</div>
      </div>
    </div>
  );
}
