import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { pb } from "../../lib/pb";
import { escPbFilter, highlightMatch } from "../../lib/searchHighlight";

type EntityKind = "deal" | "company" | "contact";
type FilterEntity = "all" | EntityKind;

type SearchHit = {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  href: string;
};

type SearchDeal = { id: string; title?: string; current_score?: number; expand?: { company_id?: { name?: string } } };
type SearchCompany = { id: string; name?: string; inn?: string; city?: string };
type SearchContact = { id: string; deal_id?: string; full_name?: string; position?: string };

function parseQuery(raw: string): { entity: FilterEntity; term: string } {
  const q = raw.trim();
  const m = q.match(/^(deal|company|contact)\s*:\s*(.+)$/i);
  if (!m) return { entity: "all", term: q };
  return { entity: m[1].toLowerCase() as EntityKind, term: m[2].trim() };
}

function matchesAllWords(text: string, term: string): boolean {
  const normalized = String(text || "").toLocaleLowerCase("ru-RU");
  const words = String(term || "")
    .toLocaleLowerCase("ru-RU")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!words.length) return true;
  return words.every((w) => normalized.includes(w));
}

function pbWordFilter(fields: string[], term: string): string {
  const words = term.split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 2);
  if (!words.length) return "";
  const parts: string[] = [];
  for (const w of words.slice(0, 4)) {
    const esc = escPbFilter(w);
    const or = fields.map((f) => `${f}~"${esc}"`).join(" || ");
    parts.push(`(${or})`);
  }
  return parts.join(" && ");
}

const KIND_LABEL: Record<EntityKind, string> = {
  deal: "Сделка",
  company: "Компания",
  contact: "Контакт",
};

const RECENT_KEY = "nwlvl_global_search_recent_v1";

export function GlobalSearchPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const q0 = sp.get("q") ?? "";
  const [q, setQ] = React.useState(q0);
  const [entityFilter, setEntityFilter] = React.useState<FilterEntity>("all");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
    } catch {
      return [];
    }
  });
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const runSearch = React.useCallback(async (query: string, filter: FilterEntity) => {
    const parsed = parseQuery(query);
    const term = parsed.term.trim();
    const entity = filter === "all" ? parsed.entity : filter;
    if (!term) {
      setHits([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next: SearchHit[] = [];
      if (entity === "all" || entity === "deal") {
        const filterExpr = pbWordFilter(["title"], term);
        const d = await pb.collection("deals").getList(1, 50, {
          sort: "-updated",
          expand: "company_id",
          ...(filterExpr ? { filter: filterExpr } : {}),
        });
        for (const x of d.items as SearchDeal[]) {
          const blob = [x.title, x.expand?.company_id?.name, x.current_score].join(" ");
          if (!filterExpr && !matchesAllWords(blob, term)) continue;
          next.push({
            id: x.id,
            kind: "deal",
            title: x.title || "Без названия",
            subtitle: `${x.expand?.company_id?.name || "—"} · AI ${typeof x.current_score === "number" ? x.current_score : "—"}`,
            href: `/deals/${x.id}`,
          });
        }
      }
      if (entity === "all" || entity === "company") {
        const filterExpr = pbWordFilter(["name", "inn", "city"], term);
        const c = await pb.collection("companies").getList(1, 50, {
          sort: "name",
          ...(filterExpr ? { filter: filterExpr } : {}),
        });
        for (const x of c.items as SearchCompany[]) {
          const blob = [x.name, x.inn, x.city].join(" ");
          if (!filterExpr && !matchesAllWords(blob, term)) continue;
          next.push({
            id: x.id,
            kind: "company",
            title: x.name || "Без названия",
            subtitle: `${x.inn || "ИНН —"} · ${x.city || "Город —"}`,
            href: `/companies/${x.id}`,
          });
        }
      }
      if (entity === "all" || entity === "contact") {
        const filterExpr = pbWordFilter(["full_name", "position"], term);
        const ct = await pb.collection("contacts_found").getList(1, 50, {
          sort: "-updated",
          ...(filterExpr ? { filter: filterExpr } : {}),
        });
        for (const x of ct.items as SearchContact[]) {
          const blob = [x.full_name, x.position, x.deal_id].join(" ");
          if (!filterExpr && !matchesAllWords(blob, term)) continue;
          if (!x.deal_id) continue;
          next.push({
            id: x.id,
            kind: "contact",
            title: x.full_name || "Без имени",
            subtitle: x.position || "Контакт",
            href: `/deals/${x.deal_id}`,
          });
        }
      }
      setHits(next.slice(0, 45));
      setActiveIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка глобального поиска");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function commitSearch(term: string) {
    const t = term.trim();
    const n = new URLSearchParams(sp);
    if (t) n.set("q", t);
    else n.delete("q");
    setSp(n, { replace: true });
    if (t) {
      setRecent((prev) => {
        const next = [t, ...prev.filter((x) => x !== t)].slice(0, 8);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    }
    void runSearch(t, entityFilter);
  }

  React.useEffect(() => {
    const parsed = parseQuery(q0);
    setEntityFilter(parsed.entity);
    void runSearch(q0, parsed.entity);
  }, [q0, runSearch]);

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-hit-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, hits.length]);

  function openHit(h: SearchHit) {
    nav(h.href);
  }

  const parsed = parseQuery(q);
  const highlightTerm = parsed.term;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-base font-extrabold tracking-wide">Глобальный поиск</div>
            <div className="text-xs text-text2 mt-1">
              Операторы: <code>deal:</code> <code>company:</code> <code>contact:</code> · ↑↓ Enter для перехода
            </div>
          </div>
          <Badge>Quick Jump</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: deal: тендер рсхб"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSearch(q);
                return;
              }
              if (e.key === "ArrowDown" && hits.length) {
                e.preventDefault();
                setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
              }
              if (e.key === "ArrowUp" && hits.length) {
                e.preventDefault();
                setActiveIdx((i) => Math.max(0, i - 1));
              }
            }}
          />
          <Button onClick={() => commitSearch(q)} className="sm:shrink-0">
            Найти
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["all", "deal", "company", "contact"] as FilterEntity[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                entityFilter === f
                  ? "border-primary bg-[rgba(51,215,255,0.18)] text-text"
                  : "border-border text-text2 hover:border-primary/40"
              }`}
              onClick={() => {
                setEntityFilter(f);
                void runSearch(q0 || q, f);
              }}
            >
              {f === "all" ? "Все" : KIND_LABEL[f]}
            </button>
          ))}
        </div>

        {recent.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                className="text-[11px] rounded-full border border-border px-2 py-0.5 text-text2 hover:text-text"
                onClick={() => {
                  setQ(r);
                  commitSearch(r);
                }}
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? <div className="mt-3 text-sm text-text2">Идёт поиск…</div> : null}
        {error ? <div className="mt-3 text-sm text-danger">{error}</div> : null}

        <div ref={listRef} className="mt-4 space-y-1 max-h-[min(70vh,560px)] overflow-y-auto">
          {hits.length ? (
            hits.map((h, idx) => (
              <button
                key={`${h.kind}-${h.id}`}
                data-hit-idx={idx}
                type="button"
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  idx === activeIdx
                    ? "border-primary bg-[rgba(51,215,255,0.14)]"
                    : "border-border bg-rowHover/60 hover:border-primary/50"
                }`}
                onClick={() => openHit(h)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">{KIND_LABEL[h.kind]}</span>
                  <div className="text-sm font-medium flex-1 min-w-0 truncate">{highlightMatch(h.title, highlightTerm)}</div>
                </div>
                <div className="text-xs text-text2 mt-1">{highlightMatch(h.subtitle, highlightTerm)}</div>
              </button>
            ))
          ) : (
            <div className="text-sm text-text2 py-4">{q0 ? "Нет совпадений" : "Введите запрос"}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
