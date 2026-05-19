import React from "react";
import NumberFlow from "@number-flow/react";
import type { LucideProps } from "lucide-react";
import { cn } from "../../../lib/cn";

export function StatCard({
  title,
  value,
  numericValue,
  suffix,
  icon: Icon,
  hint,
  className,
}: {
  title: string;
  value: string;
  numericValue?: number;
  suffix?: string;
  icon: React.ComponentType<LucideProps>;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("ui-card p-3.5 neon-accent", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-text2 font-semibold">{title}</div>
          <div className="mt-1 text-xl font-extrabold text-text tabular-nums">
            {typeof numericValue === "number" && Number.isFinite(numericValue) ? (
              <>
                <NumberFlow value={numericValue} locales="ru-RU" />
                {suffix ? <span>{suffix}</span> : null}
              </>
            ) : (
              value
            )}
          </div>
          {hint ? <div className="mt-1 text-xs text-text2">{hint}</div> : null}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-[rgba(51,215,255,0.45)] bg-[rgba(51,215,255,0.12)] shadow-[0_0_16px_rgba(51,215,255,0.22)]">
          <Icon size={18} className="text-text" />
        </div>
      </div>
    </div>
  );
}
