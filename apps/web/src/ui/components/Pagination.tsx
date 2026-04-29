import React from "react";
import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (next: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <div className="text-xs text-text2">Страница {page} из {totalPages}</div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={!canPrev} onClick={() => onPage(page - 1)}>
          Назад
        </Button>

        {start > 1 ? (
          <Button variant="secondary" onClick={() => onPage(1)}>
            1
          </Button>
        ) : null}
        {start > 2 ? <div className="text-text2 px-1">…</div> : null}

        {pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "primary" : "secondary"}
            onClick={() => onPage(p)}
          >
            {p}
          </Button>
        ))}

        {end < totalPages - 1 ? <div className="text-text2 px-1">…</div> : null}
        {end < totalPages ? (
          <Button variant="secondary" onClick={() => onPage(totalPages)}>
            {totalPages}
          </Button>
        ) : null}

        <Button variant="secondary" disabled={!canNext} onClick={() => onPage(page + 1)}>
          Вперёд
        </Button>
      </div>
    </div>
  );
}
