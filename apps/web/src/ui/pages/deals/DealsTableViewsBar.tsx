import React from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { Button } from "../../components/Button";
import { toast } from "../../../lib/toast";

export type DealsTableView = {
  id: string;
  name: string;
  columnVisibility: VisibilityState;
  searchParams: Record<string, string>;
};

const VIEWS_KEY = "nwlvl_deals_views_v2";

export function loadDealsViews(): DealsTableView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDealsViews(views: DealsTableView[]) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views.slice(0, 30)));
}

export function DealsTableViewsBar({
  currentParams,
  columnVisibility,
  onApplyView,
  onColumnVisibilityChange,
}: {
  currentParams: URLSearchParams;
  columnVisibility: VisibilityState;
  onApplyView: (params: URLSearchParams, visibility: VisibilityState) => void;
  onColumnVisibilityChange: (v: VisibilityState) => void;
}) {
  const [views, setViews] = React.useState<DealsTableView[]>(() => loadDealsViews());
  const [activeId, setActiveId] = React.useState("");

  function snapshotParams(): Record<string, string> {
    const out: Record<string, string> = {};
    currentParams.forEach((val, key) => {
      if (key !== "page") out[key] = val;
    });
    return out;
  }

  function saveView() {
    const name = window.prompt("Название вида таблицы");
    if (!name?.trim()) return;
    const view: DealsTableView = {
      id: `v_${Date.now()}`,
      name: name.trim(),
      columnVisibility: { ...columnVisibility },
      searchParams: snapshotParams(),
    };
    const next = [view, ...views];
    setViews(next);
    saveDealsViews(next);
    setActiveId(view.id);
    toast.success(`Вид «${view.name}» сохранён`);
  }

  function applyView(id: string) {
    const v = views.find((x) => x.id === id);
    if (!v) return;
    const sp = new URLSearchParams(v.searchParams);
    sp.set("page", "1");
    onApplyView(sp, v.columnVisibility);
    onColumnVisibilityChange(v.columnVisibility);
    setActiveId(id);
    toast.info(`Применён вид «${v.name}»`);
  }

  function deleteView(id: string) {
    const v = views.find((x) => x.id === id);
    if (!v) return;
    if (!window.confirm(`Удалить вид «${v.name}»?`)) return;
    const next = views.filter((x) => x.id !== id);
    setViews(next);
    saveDealsViews(next);
    if (activeId === id) setActiveId("");
    toast.success("Вид удалён");
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-text2 shrink-0">Виды</span>
      <select
        className="ui-input h-8 min-w-[140px] flex-1 max-w-xs text-sm"
        value={activeId}
        onChange={(e) => {
          const id = e.target.value;
          if (id) applyView(id);
          else setActiveId("");
        }}
      >
        <option value="">Выберите вид…</option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button small variant="secondary" onClick={saveView}>Сохранить текущий</Button>
        {activeId ? (
          <Button small variant="ghost" onClick={() => deleteView(activeId)}>Удалить вид</Button>
        ) : null}
      </div>
    </div>
  );
}
