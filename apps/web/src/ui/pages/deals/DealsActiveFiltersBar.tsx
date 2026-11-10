import React from "react";
import { Button } from "../../components/Button";
import { DEAL_FILTER_LABELS, DEAL_FILTER_PARAM_KEYS } from "./dealsFilters";

type LabelMap = Map<string, string> | Record<string, string>;

function mappedLabel(map: LabelMap | undefined, value: string) {
  if (!map) return value;
  return map instanceof Map ? map.get(value) ?? value : map[value] ?? value;
}

export function DealsActiveFiltersBar({
  sp,
  setSp,
  stages,
  users,
}: {
  sp: URLSearchParams;
  setSp: (next: URLSearchParams, options?: { replace?: boolean }) => void;
  stages?: LabelMap;
  users?: LabelMap;
}) {
  const active = [
    ...(sp.get("search")?.trim() ? [{ key: "search", label: "Поиск", value: sp.get("search")!.trim() }] : []),
    ...DEAL_FILTER_PARAM_KEYS.flatMap((key) => {
      const value = sp.get(key)?.trim();
      if (!value) return [];
      const display = key === "stage" ? mappedLabel(stages, value) : key === "owner" ? mappedLabel(users, value) : value;
      return [{ key, label: DEAL_FILTER_LABELS[key], value: display }];
    }),
  ];

  if (!active.length) return null;

  const remove = (key: string) => {
    const next = new URLSearchParams(sp);
    next.delete(key);
    next.set("page", "1");
    setSp(next, { replace: true });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {active.map((item) => (
        <span key={item.key} className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-[rgba(255,255,255,0.06)] px-3 text-xs">
          <span><span className="text-text2">{item.label}:</span> {item.value}</span>
          <button type="button" className="text-text2 hover:text-danger" aria-label={`Убрать фильтр «${item.label}»`} onClick={() => remove(item.key)}>×</button>
        </span>
      ))}
      <Button
        small
        variant="secondary"
        onClick={() => {
          const next = new URLSearchParams(sp);
          next.delete("search");
          DEAL_FILTER_PARAM_KEYS.forEach((key) => next.delete(key));
          next.set("page", "1");
          setSp(next, { replace: true });
        }}
      >
        Сбросить все
      </Button>
    </div>
  );
}
