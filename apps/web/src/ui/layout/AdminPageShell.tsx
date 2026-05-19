import React from "react";
import { cn } from "../../lib/cn";

/** Единая оболочка для разделов администратора (редизайн в процессе). */
export function AdminPageShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="ui-card p-4 neon-accent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(51,215,255,0.35)] bg-[rgba(51,215,255,0.10)] px-3 py-1 text-[11px] font-semibold text-text2 mb-2">
              Администрирование
            </div>
            <h1 className="text-lg font-extrabold text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-text2">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
