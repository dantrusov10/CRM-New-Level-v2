import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { pb } from "../../lib/pb";

type SearchDeal = { id: string; title?: string; current_score?: number; expand?: { company_id?: { name?: string } } };
type SearchCompany = { id: string; name?: string; inn?: string; city?: string };
type SearchContact = { id: string; deal_id?: string; full_name?: string; position?: string; company_id?: string };

function safe(v: string) {
  return v.replace(/"/g, '\\"');
}

function parseQuery(raw: string): { entity: "all" | "deal" | "company" | "contact"; term: string } {
  const q = raw.trim();
  const m = q.match(/^(deal|company|contact)\s*:\s*(.+)$/i);
  if (!m) return { entity: "all", term: q };
  return { entity: m[1].toLowerCase() as "deal" | "company" | "contact", term: m[2].trim() };
}

function includesCi(value: unknown, term: string): boolean {
  return String(value || "").toLocaleLowerCase("ru-RU").includes(term.toLocaleLowerCase("ru-RU"));
}

export function GlobalSearchPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const q0 = sp.get("q") ?? "";
  const [q, setQ] = React.useState(q0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [deals, setDeals] = React.useState<SearchDeal[]>([]);
  const [companies, setCompanies] = React.useState<SearchCompany[]>([]);
  const [contacts, setContacts] = React.useState<SearchContact[]>([]);

  const runSearch = React.useCallback(async (query: string) => {
    const parsed = parseQuery(query);
    if (!parsed.term) {
      setDeals([]);
      setCompanies([]);
      setContacts([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const term = parsed.term.trim();
      if (parsed.entity === "all" || parsed.entity === "deal") {
        const d = await pb.collection("deals").getList(1, 200, {
          sort: "-updated",
          expand: "company_id",
        });
        setDeals(
          (d.items as SearchDeal[])
            .filter((x) => includesCi(x.title, term) || includesCi(x.expand?.company_id?.name, term))
            .slice(0, 15),
        );
      } else setDeals([]);
      if (parsed.entity === "all" || parsed.entity === "company") {
        const c = await pb.collection("companies").getList(1, 200, {
          sort: "name",
        });
        setCompanies(
          (c.items as SearchCompany[])
            .filter((x) => includesCi(x.name, term) || includesCi(x.inn, term) || includesCi(x.city, term))
            .slice(0, 15),
        );
      } else setCompanies([]);
      if (parsed.entity === "all" || parsed.entity === "contact") {
        const ct = await pb.collection("contacts_found").getList(1, 200, {
          sort: "-updated",
        });
        setContacts(
          (ct.items as SearchContact[])
            .filter((x) => includesCi(x.full_name, term) || includesCi(x.position, term))
            .slice(0, 15),
        );
      } else setContacts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка глобального поиска");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void runSearch(q0);
  }, [q0, runSearch]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-base font-extrabold tracking-wide">Глобальный поиск</div>
            <div className="text-xs text-text2 mt-1">Единое поле по сделкам, компаниям и контактам. Операторы: `deal:`, `company:`, `contact:`</div>
          </div>
          <Badge>Quick Jump</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например: deal: тендер рсхб"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = new URLSearchParams(sp);
                n.set("q", q.trim());
                setSp(n, { replace: true });
              }
            }}
          />
          <Button
            onClick={() => {
              const n = new URLSearchParams(sp);
              n.set("q", q.trim());
              setSp(n, { replace: true });
            }}
          >
            Найти
          </Button>
        </div>
        {loading ? <div className="mt-3 text-sm text-text2">Идет поиск...</div> : null}
        {error ? <div className="mt-3 text-sm text-danger">{error}</div> : null}

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="rounded-card border border-border bg-card p-3">
            <div className="text-sm font-semibold mb-2">Сделки ({deals.length})</div>
            <div className="grid gap-2">
              {deals.map((d) => (
                <button key={d.id} className="text-left rounded-md border border-border bg-rowHover/60 p-2 hover:border-primary/50" onClick={() => nav(`/deals/${d.id}`)}>
                  <div className="text-sm font-medium">{d.title || "Без названия"}</div>
                  <div className="text-xs text-text2">{d.expand?.company_id?.name || "—"} · score {typeof d.current_score === "number" ? d.current_score : "—"}</div>
                </button>
              ))}
              {!deals.length ? <div className="text-xs text-text2">Нет совпадений</div> : null}
            </div>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <div className="text-sm font-semibold mb-2">Компании ({companies.length})</div>
            <div className="grid gap-2">
              {companies.map((c) => (
                <button key={c.id} className="text-left rounded-md border border-border bg-rowHover/60 p-2 hover:border-primary/50" onClick={() => nav(`/companies/${c.id}`)}>
                  <div className="text-sm font-medium">{c.name || "Без названия"}</div>
                  <div className="text-xs text-text2">{c.inn || "ИНН —"} · {c.city || "Город —"}</div>
                </button>
              ))}
              {!companies.length ? <div className="text-xs text-text2">Нет совпадений</div> : null}
            </div>
          </div>
          <div className="rounded-card border border-border bg-card p-3">
            <div className="text-sm font-semibold mb-2">Контакты ({contacts.length})</div>
            <div className="grid gap-2">
              {contacts.map((c) => (
                <button key={c.id} className="text-left rounded-md border border-border bg-rowHover/60 p-2 hover:border-primary/50" onClick={() => c.deal_id && nav(`/deals/${c.deal_id}`)}>
                  <div className="text-sm font-medium">{c.full_name || "Без имени"}</div>
                  <div className="text-xs text-text2">{c.position || "Должность —"} · {c.deal_id ? "Открыть сделку" : "Сделка не привязана"}</div>
                </button>
              ))}
              {!contacts.length ? <div className="text-xs text-text2">Нет совпадений</div> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
