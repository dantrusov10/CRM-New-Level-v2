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
import dayjs from "dayjs";
import type { Deal } from "../../../lib/types";
import { cn } from "../../../lib/cn";

const STORAGE_KEY = "nwlvl_deals_table_v1";

type TablePrefs = {
  columnSizing: ColumnSizingState;
  columnPinning: ColumnPinningState;
  columnVisibility: VisibilityState;
};

const DEFAULT_PREFS: TablePrefs = {
  columnSizing: {},
  columnPinning: { left: ["select", "title"], right: [] },
  columnVisibility: {},
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

export function DealsDataTable({
  items,
  selected,
  allPageSelected,
  onToggleOne,
  onTogglePage,
  onRowClick,
}: {
  items: Deal[];
  selected: Set<string>;
  allPageSelected: boolean;
  onToggleOne: (id: string, next?: boolean) => void;
  onTogglePage: (next?: boolean) => void;
  onRowClick: (id: string) => void;
}) {
  const [prefs, setPrefs] = React.useState<TablePrefs>(loadPrefs);
  const [showColumns, setShowColumns] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

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
      columnHelper.accessor("title", {
        header: "Сделка",
        size: 220,
        minSize: 140,
        enablePinning: true,
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor((d) => d.expand?.company_id?.name ?? "—", {
        id: "company",
        header: "Компания",
        size: 160,
        cell: (info) => <span className="text-text2">{info.getValue()}</span>,
      }),
      columnHelper.accessor((d) => d.expand?.responsible_id?.full_name ?? d.expand?.responsible_id?.email ?? "—", {
        id: "owner",
        header: "Ответственный",
        size: 150,
        cell: (info) => <span className="text-text2">{info.getValue()}</span>,
      }),
      columnHelper.accessor((d) => d.expand?.stage_id?.stage_name ?? "—", {
        id: "stage",
        header: "Этап",
        size: 140,
        cell: ({ row }) => {
          const d = row.original;
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: d.expand?.stage_id?.color ?? "#9CA3AF" }}
              />
              <span className="text-text2">{d.expand?.stage_id?.stage_name ?? "—"}</span>
            </span>
          );
        },
      }),
      columnHelper.accessor("budget", {
        header: "Бюджет",
        size: 110,
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() ? info.getValue()!.toLocaleString("ru-RU") : "—"}</span>
        ),
      }),
      columnHelper.accessor("turnover", {
        header: "Оборот",
        size: 110,
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() ? info.getValue()!.toLocaleString("ru-RU") : "—"}</span>
        ),
      }),
      columnHelper.accessor("margin_percent", {
        header: "Маржа %",
        size: 90,
        cell: (info) => (
          <span className="tabular-nums">{typeof info.getValue() === "number" ? `${info.getValue()}%` : "—"}</span>
        ),
      }),
      columnHelper.accessor("sales_channel", {
        header: "Канал",
        size: 120,
        cell: (info) => <span className="text-text2">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("updated", {
        header: "Обновлено",
        size: 140,
        cell: (info) => (
          <span className="text-text2">{info.getValue() ? dayjs(info.getValue()).format("DD.MM.YYYY HH:mm") : "—"}</span>
        ),
      }),
    ],
    [allPageSelected, onToggleOne, onTogglePage, selected]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      columnSizing: prefs.columnSizing,
      columnPinning: prefs.columnPinning,
      columnVisibility: prefs.columnVisibility,
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
      setPrefs((p) => ({
        ...p,
        columnVisibility: typeof updater === "function" ? updater(p.columnVisibility) : updater,
      }));
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
        <div className="mb-3 flex flex-wrap gap-2 p-2 rounded-card border border-border bg-[rgba(255,255,255,0.04)]">
          {table.getAllLeafColumns().map((col) => {
            if (col.id === "select") return null;
            return (
              <label key={col.id} className="inline-flex items-center gap-1.5 text-xs text-text2">
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                />
                {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-auto rounded-card border border-border">
        <table className="w-full text-sm" style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="h-10 bg-tableHeader text-text font-semibold">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left px-3 relative select-none"
                    style={{ width: header.getSize(), ...pinStyle(header.column.id) }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                ))}
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
        Подсказка: тяните правый край заголовка для ширины · «Сделка» и чекбокс закреплены слева
      </p>
    </div>
  );
}
