import React from "react";
import { Button } from "../../components/Button";
import {
  type NextActionGroup,
  type ParsedRisk,
  type ScoringExplainability,
  formatDelta,
} from "./dealAiDisplay";

export function DealNextActionsList({
  groups,
  actions,
  onCreateTask,
  onRespond,
}: {
  groups?: NextActionGroup[];
  actions?: string[];
  onCreateTask: (text: string) => void;
  onRespond: (text: string) => void;
}) {
  const resolved: NextActionGroup[] =
    groups && groups.length
      ? groups
      : actions?.length
        ? [{ items: actions }]
        : [];

  if (!resolved.length || !resolved.some((g) => g.items.length)) {
    return <div className="text-sm text-text2">Запусти AI, чтобы получить список следующих шагов.</div>;
  }

  return (
    <div className="grid gap-4">
      {resolved.map((group, gi) => (
        <div key={`${group.title ?? "group"}-${gi}`} className="grid gap-2">
          {group.title ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-text2">{group.title}</div>
          ) : null}
          <ul className="grid gap-3 text-sm">
            {group.items.map((item, idx) => (
              <li
                key={`${item.slice(0, 40)}-${idx}`}
                className="rounded-md border border-border bg-rowHover/70 p-2.5 grid gap-2"
              >
                <p className="leading-relaxed text-text w-full">{item}</p>
                <div className="flex flex-wrap gap-2">
                  <Button small variant="secondary" onClick={() => onCreateTask(item)}>
                    Создать задачу
                  </Button>
                  <Button small variant="secondary" onClick={() => onRespond(item)}>
                    Ответить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DealScoringExplainPanel({ data }: { data: ScoringExplainability }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-card border border-border bg-rowHover p-3 text-sm">
        <div className="text-xs text-text2 mb-2">Сводка</div>
        <ul className="grid gap-1.5">
          <li>
            Метод: <span className="font-semibold">{data.methodLabel}</span>
          </li>
          <li>
            Вероятность:{" "}
            <span className="font-semibold">{data.finalProbability != null ? `${data.finalProbability}%` : "—"}</span>
            {data.probabilityDelta != null ? (
              <span
                className={`ml-2 text-xs font-semibold ${
                  data.probabilityDelta > 0 ? "text-[#22c55e]" : data.probabilityDelta < 0 ? "text-danger" : "text-text2"
                }`}
              >
                ({formatDelta(data.probabilityDelta, " п.п.")} к прошлому анализу)
              </span>
            ) : data.hasPrevious ? null : (
              <span className="ml-2 text-xs text-text2">(первый анализ — сравнение появится после обновления)</span>
            )}
          </li>
        </ul>
      </div>

      {data.factors.length ? (
        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-text2">
            {data.hasPrevious ? "Что изменило оценку" : "Главные факторы оценки"}
          </div>
          {data.factors.map((f) => (
            <div key={f.code} className="rounded-md border border-border bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{f.label}</div>
                {f.valueDelta != null ? (
                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      f.valueDelta > 0 ? "text-[#22c55e]" : f.valueDelta < 0 ? "text-danger" : "text-text2"
                    }`}
                  >
                    оценка {formatDelta(f.valueDelta, " п.")}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.12)]">
                <div
                  className="h-1.5 rounded-full bg-primary/80"
                  style={{ width: `${Math.max(0, Math.min(100, f.value))}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-text2">
                Сейчас: {f.value.toFixed(1)} / 100 · Вклад: {f.contribution.toFixed(2)}
                {f.contributionDelta != null ? (
                  <span className="ml-1 font-medium">({formatDelta(f.contributionDelta, " к прошлому")})</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : data.hasPrevious ? (
        <div className="text-xs text-text2">Значимых изменений по факторам не зафиксировано.</div>
      ) : null}
    </div>
  );
}

export function DealRisksPanel({ risks }: { risks: ParsedRisk[] }) {
  if (!risks.length) {
    return <div className="text-sm text-text2">Риски не выделены.</div>;
  }
  return (
    <ul className="grid gap-3 text-sm">
      {risks.map((risk, idx) => (
        <li key={`${risk.name}-${idx}`} className="rounded-md border border-border bg-rowHover/80 p-2.5">
          <div className="text-xs text-text2">Риск</div>
          <div className="font-medium leading-snug mt-0.5">{risk.name}</div>
          {risk.description ? (
            <>
              <div className="text-xs text-text2 mt-2">Описание</div>
              <p className="text-xs text-text2 leading-relaxed mt-0.5">{risk.description}</p>
            </>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {risk.criticality ? (
              <span>
                <span className="text-text2">Критичность: </span>
                <span className="font-medium">{risk.criticality}</span>
              </span>
            ) : null}
            {risk.probability != null ? (
              <span>
                <span className="text-text2">Вероятность: </span>
                <span className="font-medium">{risk.probability}%</span>
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
