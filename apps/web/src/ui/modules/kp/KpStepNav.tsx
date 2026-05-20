import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { KpProcessStep } from "./kpProcess";

export function KpStepNav({
  steps,
  currentId,
  completedIds,
  onSelect,
}: {
  steps: KpProcessStep[];
  currentId: string;
  completedIds?: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="crm-scrollbar overflow-x-auto pb-1">
      <div className="flex gap-2 min-w-max">
        {steps.map((s, idx) => {
          const active = s.id === currentId;
          const done = completedIds?.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`rounded-card border px-3 py-2 text-left transition-colors min-w-[140px] max-w-[200px] ${
                active
                  ? "border-primary bg-[rgba(45,123,255,0.18)]"
                  : "border-border bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-text2">
                {done ? <CheckCircle2 size={12} className="text-success shrink-0" /> : <span className="font-bold">{idx + 1}</span>}
                <span className="truncate">{s.title}</span>
              </div>
              {active ? <div className="text-xs font-semibold mt-1 line-clamp-2">{s.hint}</div> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
