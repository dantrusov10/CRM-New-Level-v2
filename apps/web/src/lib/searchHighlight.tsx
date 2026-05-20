import React from "react";

/** Подсветка совпадений поискового запроса (по словам). */
export function highlightMatch(text: string, term: string): React.ReactNode {
  const src = String(text || "");
  if (!src || !term.trim()) return src || "—";

  const words = term
    .toLocaleLowerCase("ru-RU")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  if (!words.length) return src;

  const lower = src.toLocaleLowerCase("ru-RU");
  const spans: Array<{ start: number; end: number }> = [];
  for (const w of words) {
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(w, from);
      if (idx < 0) break;
      spans.push({ start: idx, end: idx + w.length });
      from = idx + w.length;
    }
  }
  if (!spans.length) return src;

  spans.sort((a, b) => a.start - b.start);
  const merged: typeof spans = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else merged.push({ ...s });
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((m, i) => {
    if (m.start > cursor) parts.push(src.slice(cursor, m.start));
    parts.push(
      <mark key={`${m.start}-${i}`} className="rounded px-0.5 bg-[rgba(51,215,255,0.28)] text-text">
        {src.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < src.length) parts.push(src.slice(cursor));
  return <>{parts}</>;
}

export function escPbFilter(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
