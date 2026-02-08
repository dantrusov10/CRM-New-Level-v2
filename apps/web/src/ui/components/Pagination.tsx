import React from "react";
import clsx from "clsx";

export function Pagination({
  page,
  totalPages,
  onPage,
  className,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);

  const pages: (number | "…")[] = [];
  const push = (v: number | "…") => pages.push(v);

  push(1);
  if (safePage > 3) push("…");
  for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) push(p);
  if (safePage < totalPages - 2) push("…");
  if (totalPages > 1) push(totalPages);

  return (
    <div className={clsx("pagination flex items-center justify-between gap-3 mt-4", className)} data-pagination="true">
      <div className="text-xs text-text2">Страница {safePage} из {totalPages}</div>

      <div className="flex items-center gap-2">
        <button
          className="h-9 px-3 rounded-card border border-border bg-white text-sm font-semibold disabled:opacity-40"
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
        >
          Назад
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`dots-${i}`} className="px-2 text-text2">…</span>
            ) : (
              <button
                key={p}
                className={clsx(
                  "h-9 min-w-9 px-3 rounded-card border border-border text-sm font-semibold",
                  p === safePage ? "bg-primary text-white border-primary" : "bg-white"
                )}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          className="h-9 px-3 rounded-card border border-border bg-white text-sm font-semibold disabled:opacity-40"
          onClick={() => onPage(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
