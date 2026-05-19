import React from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { toast, type ToastItem, type ToastKind } from "../../lib/toast";

const ICON: Record<ToastKind, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLE: Record<ToastKind, string> = {
  success: "border-[rgba(0,216,122,0.45)] bg-[rgba(0,216,122,0.12)]",
  error: "border-[rgba(255,91,107,0.55)] bg-[rgba(255,91,107,0.12)]",
  info: "border-[rgba(51,215,255,0.45)] bg-[rgba(51,215,255,0.10)]",
  warning: "border-[rgba(255,193,7,0.45)] bg-[rgba(255,193,7,0.10)]",
};

function ToastCard({ item }: { item: ToastItem }) {
  const Icon = ICON[item.kind];
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-[14px] border px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md animate-[toast-in_0.28s_ease-out]",
        STYLE[item.kind]
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <Icon size={18} className="text-text shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          {item.title ? <div className="text-xs font-bold text-text">{item.title}</div> : null}
          <div className={cn("text-sm text-text", item.title && "mt-0.5")}>{item.message}</div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 hover:bg-[rgba(255,255,255,0.08)]"
          onClick={() => toast.dismiss(item.id)}
          aria-label="Закрыть"
        >
          <X size={14} className="text-text2" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const [list, setList] = React.useState<ToastItem[]>([]);
  React.useEffect(() => toast.subscribe(setList), []);
  if (!list.length) return null;
  return (
    <div className="fixed top-3 right-3 z-[9999] flex flex-col gap-2 pointer-events-none sm:top-4 sm:right-4 max-w-[min(100vw-1.5rem,24rem)]">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
