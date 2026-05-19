import React from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnPinningState,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Deal } from "../../../lib/types";
import { cn } from "../../../lib/cn";
import { buildDealColumns, DEAL_COLUMN_META, DEFAULT_COLUMN_VISIBILITY } from "./dealsTableColumns";
import { isSortableColumn, parseDealSortParam } from "./dealsTableSort";

const STORAGE_KEY = "nwlvl_deals_table_v1";

type TablePrefs = {
  columnSizing: ColumnSizingState;
  columnPinning: ColumnPinningState;
  columnVisibility: VisibilityState;
};

const DEFAULT_PREFS: TablePrefs = {
  columnSizing: {},
  columnPinning: { left: ["select", "title"], right: [] },
  columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
};

function loadPrefs(): TablePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

const columnHelper = createColumnHelper<Deal>();

function SortIcon({ columnId, sortParam }: { columnId: string; sortParam?: string | null }) {
  const parsed = parseDealSortParam(sortParam);
  if (parsed?.columnId !== columnId) return <ArrowUpDown size={12} className="opacity-40" />;
  return parsed.dir === "asc" ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />;
}

export function DealsDataTable({
  items,
  selected,
  allPageSelected,
  onToggleOne,
  onTogglePage,
  onRowClick,
  visibilityOverride,
  onVisibilityChange,
  sortParam,
  onSortColumn,
}: {
  items: Deal[];
  selected: Set<string>;
  allPageSelected: boolean;
  onToggleOne: (id: string, next?: boolean) => void;
  onTogglePage: (next?: boolean) => void;
  onRowClick: (id: string) => void;
  visibilityOverride?: VisibilityState | null;
  onVisibilityChange?: (v: VisibilityState) => void;
  sortParam?: string | null;
  onSortColumn?: (columnId: string) => void;
}) {
  const [prefs, setPrefs] = React.useState<TablePrefs>(loadPrefs);
  const [showColumns, setShowColumns] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const mergedVisibility = React.useMemo(
    () => ({
      ...DEFAULT_COLUMN_VISIBILITY,
      ...prefs.columnVisibility,
      ...(visibilityOverride ?? {}),
    }),
    [prefs.columnVisibility, visibilityOverride]
  );

  const columns = React.useMemo(
    () => [
      columnHelper.display({
        id: "select",
        size: 44,
        minSize: 40,
        maxSize: 56,
        enableResizing: false,
        enablePinning: true,
        header: () => (
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={(e) => onTogglePage(e.target.checked)}
            aria-label="Выбрать все на странице"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(String(row.original.id))}
            onChange={(e) => {
              e.stopPropagation();
              onToggleOne(String(row.original.id), e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Выбрать сделку"
          />
        ),
      }),
      ...buildDealColumns(),
    ],
    [allPageSelected, onToggleOne, onTogglePage, selected]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      columnSizing: prefs.columnSizing,
      columnPinning: prefs.columnPinning,
      columnVisibility: mergedVisibility,
    },
    onColumnSizingChange: (updater) => {
      setPrefs((p) => ({
        ...p,
        columnSizing: typeof updater === "function" ? updater(p.columnSizing) : updater,
      }));
    },
    onColumnPinningChange: (updater) => {
      setPrefs((p) => ({
        ...p,
        columnPinning: typeof updater === "function" ? updater(p.columnPinning) : updater,
      }));
    },
    onColumnVisibilityChange: (updater) => {
      setPrefs((p) => {
        const nextVisibility = typeof updater === "function" ? updater(mergedVisibility) : updater;
        onVisibilityChange?.(nextVisibility);
        return { ...p, columnVisibility: nextVisibility };
      });
    },
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableColumnPinning: true,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: { minSize: 60, size: 120 },
  });

  const pinStyle = (colId: string): React.CSSProperties => {
    const col = table.getColumn(colId);
    if (!col?.getIsPinned()) return {};
    const isLeft = col.getIsPinned() === "left";
    return {
      position: "sticky",
      left: isLeft ? col.getStart("left") : undefined,
      right: !isLeft ? col.getAfter("right") : undefined,
      zIndex: 2,
      background: "#06162C",
      boxShadow: isLeft ? "4px 0 12px rgba(0,0,0,0.25)" : undefined,
    };
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          className="text-xs text-text2 hover:text-text border border-border rounded-md px-2 py-1"
          onClick={() => setShowColumns((v) => !v)}
        >
          Колонки
        </button>
        <button
          type="button"
          className="text-xs text-text2 hover:text-text border border-border rounded-md px-2 py-1"
          onClick={() => setPrefs(DEFAULT_PREFS)}
        >
          Сбросить таблицу
        </button>
      </div>
      {showColumns ? (
        <div className="mb-3 space-y-2 p-2 rounded-card border border-border bg-[rgba(255,255,255,0.04)] max-h-56 overflow-auto crm-scrollbar">
          {(["основное", "финансы", "коммерция", "даты", "ai", "ссылки"] as const).map((group) => {
            const cols = DEAL_COLUMN_META.filter((c) => c.group === group);
            if (!cols.length) return null;
            return (
              <div key={group}>
                <div className="text-[10px] uppercase tracking-wide text-text2 mb-1">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {cols.map((meta) => {
                    const col = table.getColumn(meta.id);
                    if (!col) return null;
                    return (
                      <label key={meta.id} className="inline-flex items-center gap-1.5 text-xs text-text2">
                        <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
                        {meta.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-auto rounded-card border border-border crm-scrollbar">
        <table className="w-full text-sm" style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10 bg-tableHeader text-text font-semibold">
                {hg.headers.map((header) => {
                  const colId = header.column.id;
                  const meta = DEAL_COLUMN_META.find((m) => m.id === colId);
                  const sortable = Boolean(onSortColumn && isSortableColumn(colId));
                  return (
                  <th
                    key={header.id}
                    className="text-left px-3 relative select-none"
                    style={{ width: header.getSize(), ...pinStyle(header.column.id) }}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-primary max-w-full"
                        onClick={() => onSortColumn?.(colId)}
                        title="Сортировка: по возрастанию → по убыванию → сброс"
                      >
                        <span className="truncate">{meta?.label ?? colId}</span>
                        <SortIcon columnId={colId} sortParam={sortParam} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                    {header.column.getCanResize() ? (
                      <button
                        type="button"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none",
                          header.column.getIsResizing() ? "bg-primary" : "bg-transparent hover:bg-primary/60"
                        )}
                        aria-label="Изменить ширину колонки"
                      />
                    ) : null}
                  </th>
                );})}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="h-11 border-b border-border hover:bg-rowHover cursor-pointer"
                onClick={() => onRowClick(String(row.original.id))}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3"
                    style={{ width: cell.column.getSize(), ...pinStyle(cell.column.id) }}
                    onClick={cell.column.id === "select" ? (e) => e.stopPropagation() : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-text2">
        Клик по заголовку — сортировка (А→Я / по возрастанию, ещё раз — обратно). Тяните правый край для ширины колонки.
      </p>
    </div>
  );
}
