import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

export function Modal({
  open,
  title,
  children,
  onClose,
  widthClass = "max-w-2xl",
  bodyClassName,
  bodyOverflow = "auto",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  widthClass?: string;
  /** Доп. классы области контента (например overflow-visible для календаря). */
  bodyClassName?: string;
  /** auto — скролл внутри; visible — контент (календарь) не обрезается. */
  bodyOverflow?: "auto" | "visible";
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/78 backdrop-blur-sm px-4 py-6 sm:py-8"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "my-auto w-full flex max-h-[min(90vh,calc(100vh-2rem))] flex-col rounded-card border border-[rgba(51,215,255,0.45)] bg-[#0f2644] shadow-[0_0_26px_rgba(51,215,255,0.2)]",
          widthClass
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(51,215,255,0.32)] bg-[rgba(45,123,255,0.14)] px-4 py-3">
          <div className="text-sm font-semibold tracking-wide">{title}</div>
          <button className="rounded-card border border-[rgba(51,215,255,0.26)] p-2 hover:bg-rowHover" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 p-4",
            bodyOverflow === "visible" ? "overflow-visible" : "overflow-y-auto crm-scrollbar",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
