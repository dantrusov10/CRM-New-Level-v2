import React from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";

type Row = {
  product_name: string;
  sku?: string;
  vat_mode?: "with_vat" | "without_vat";
  price: number;
};

async function ensureDefaultPriceListId(): Promise<string | null> {
  // 1) try existing
  const existing = await pb.collection("price_lists").getList(1, 1, { sort: "-created" }).catch(() => ({ items: [] as any[] }));
  if ((existing.items || [])[0]?.id) return (existing.items || [])[0].id;

  // price_lists требует file_id. Создаём "пустой" files-рекорд.
  const f = await pb
    .collection("files")
    .create({
      path: `price_lists/default_${Date.now()}.xlsx`,
      filename: "default.xlsx",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size_bytes: 0,
    })
    .catch(() => null);
  if (!f?.id) return null;

  const pl = await pb
    .collection("price_lists")
    .create({
      name: "Прайс-лист (default)",
      file_id: f.id,
      schema_version: "v1",
    })
    .catch(() => null);
  return pl?.id || null;
}

function normalizeHeader(h: string) {
  const s = String(h || "").trim().toLowerCase();
  return s
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/\/+/g, " ")
    .trim();
}

function parseVatMode(v: any): Row["vat_mode"] {
  const s = normalizeHeader(String(v || ""));
  if (!s) return undefined;
  if (s.includes("без")) return "without_vat";
  if (s.includes("с ндс") || s.includes("сндс") || s.includes("with")) return "with_vat";
  if (s === "0" || s === "false") return "without_vat";
  return "with_vat";
}

export function PriceListAdmin() {
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState<string>("");

  async function load() {
    const q = search.trim();
    const filter = q ? `product_name~"${q.replace(/\"/g, '\\"')}"` : "";
    const res = await pb.collection("price_list_items").getList(1, 50, { sort: "product_name", filter: filter || undefined }).catch(() => ({ items: [] as any[] }));
    setItems(res.items || []);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function downloadTemplate() {
    const rows = [
      {
        "Наименование": "Лицензия — базовая",
        "Артикул": "LIC-BASE",
        "С НДС/Без НДС": "С НДС",
        "Цена": 1000,
        "Стоимость": 1000,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "price");
    XLSX.writeFile(wb, "price_list_template.xlsx");
  }

  async function exportXlsx() {
    setBusy(true);
    setStatus("Экспорт…");
    try {
      const all = await pb.collection("price_list_items").getFullList({ sort: "product_name" }).catch(() => [] as any[]);
      const rows = (all as any[]).map((it) => {
        const meta = it.meta || {};
        const mode = meta.vat_mode === "without_vat" ? "Без НДС" : "С НДС";
        return {
          "Наименование": it.product_name,
          "Артикул": it.sku || "",
          "С НДС/Без НДС": mode,
          "Цена": Number(it.price || 0),
          "Стоимость": Number(it.price || 0),
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Наименование": "", "Артикул": "", "С НДС/Без НДС": "", "Цена": "", "Стоимость": "" }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "price");
      XLSX.writeFile(wb, "price_list_export.xlsx");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function importXlsx(file: File) {
    setBusy(true);
    setStatus("Импорт…");
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const priceListId = await ensureDefaultPriceListId();
      if (!priceListId) throw new Error("Не удалось создать/получить price_list_id");

      // map headers (RU/EN)
      const rows: Row[] = json
        .map((r) => {
          const keys = Object.keys(r);
          const by = (cands: string[]) => {
            for (const k of keys) {
              const nk = normalizeHeader(k);
              if (cands.includes(nk)) return r[k];
            }
            return "";
          };
          const name = String(by(["наименование", "название", "product", "product name", "product_name"]) || "").trim();
          if (!name) return null;
          const sku = String(by(["артикул", "sku"]) || "").trim();
          const vatMode = parseVatMode(by(["с ндс/без ндс", "ндс", "vat", "vat mode", "vat_mode"]));
          const priceRaw = by(["цена", "price"]) || by(["стоимость", "cost"]);
          const price = Number(String(priceRaw).replace(/\s/g, "").replace(",", "."));
          return { product_name: name, sku: sku || undefined, vat_mode: vatMode, price: Number.isFinite(price) ? price : 0 } as Row;
        })
        .filter(Boolean) as Row[];

      // naive upsert: try find by sku (if provided) else by product_name
      let created = 0;
      let updated = 0;
      for (const r of rows) {
        const filter = r.sku
          ? `sku="${r.sku.replace(/\"/g, '\\"')}"`
          : `product_name="${r.product_name.replace(/\"/g, '\\"')}"`;
        const existing = await pb.collection("price_list_items").getList(1, 1, { filter, sort: "-created" }).catch(() => ({ items: [] as any[] }));
        const payload: any = {
          price_list_id: priceListId,
          product_name: r.product_name,
          sku: r.sku || "",
          price: r.price,
          currency: "RUB",
          meta: { vat_mode: r.vat_mode || "with_vat" },
        };
        if (existing.items?.[0]?.id) {
          await pb.collection("price_list_items").update(existing.items[0].id, payload);
          updated++;
        } else {
          await pb.collection("price_list_items").create(payload);
          created++;
        }
      }

      setStatus(`Импорт завершён: создано ${created}, обновлено ${updated}`);
      await load();
    } catch (e: any) {
      setStatus(`Ошибка импорта: ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 4000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Прайс-лист</div>
            <div className="text-xs text-text2 mt-1">Импорт/экспорт прайса для подбора позиций в КП.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={downloadTemplate}>Скачать шаблон</Button>
            <Button variant="secondary" onClick={exportXlsx}>Экспорт</Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importXlsx(f);
                  e.currentTarget.value = "";
                }}
              />
              <span className={"h-10 rounded-card px-4 text-sm border flex items-center cursor-pointer " + (busy ? "bg-rowHover border-border opacity-60" : "bg-white border-border hover:bg-rowHover")}>
                Импорт
              </span>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-text2 mb-1">Поиск</div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Лицензия / Поддержка…" />
            </div>
            <div className="flex items-end">
              {status ? <div className="text-sm text-text2">{status}</div> : null}
            </div>
          </div>

          <div className="overflow-auto rounded-card border border-border">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  <th className="text-left px-3">Наименование</th>
                  <th className="text-left px-3">Артикул</th>
                  <th className="text-left px-3">НДС</th>
                  <th className="text-right px-3">Цена</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="h-11 border-b border-border">
                    <td className="px-3">{it.product_name}</td>
                    <td className="px-3 text-text2">{it.sku || "—"}</td>
                    <td className="px-3 text-text2">{(it.meta?.vat_mode || "with_vat") === "without_vat" ? "Без НДС" : "С НДС"}</td>
                    <td className="px-3 text-right">{Number(it.price || 0)}</td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-sm text-text2">Пока пусто.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
