import React from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { pb } from "../../../lib/pb";
import { KpPreview } from "./KpPreview";
import { computeSpecification } from "./calc";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";
import type { SpecItem } from "./types";

function uid(prefix = "i") {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
}

function currencyOf(template: any) {
  return template?.defaults?.currency || "RUB";
}

function vatOf(template: any) {
  const v = Number(template?.defaults?.vatPercent ?? 20);
  return Number.isFinite(v) ? v : 20;
}

async function ensureDefaultTemplate() {
  // Try to load default template; if not exists, create from DEFAULT_KP_TEMPLATE_V1.
  const list = await pb
    .collection("settings_kp_templates")
    .getList(1, 1, { filter: "is_default=true && is_active=true" })
    .catch(() => ({ items: [] as any[] }));

  if (list.items[0]) return list.items[0];

  // If collection exists but empty — create.
  const created = await pb
    .collection("settings_kp_templates")
    .create({
      name: DEFAULT_KP_TEMPLATE_V1.name,
      is_active: true,
      is_default: true,
      template_json: DEFAULT_KP_TEMPLATE_V1,
    })
    .catch(() => null);

  return created;
}

export function DealKpModule({ deal, onTimeline }: { deal: any; onTimeline?: (action: string, comment?: string, payload?: any) => Promise<void> }) {
  const dealId = deal?.id;
  const company = deal?.expand?.company_id;

  const [loading, setLoading] = React.useState(true);
  const [templateRec, setTemplateRec] = React.useState<any>(null);
  const [template, setTemplate] = React.useState<any>(DEFAULT_KP_TEMPLATE_V1);

  const [instance, setInstance] = React.useState<any>(null);
  const [input, setInput] = React.useState<any>({});
  const [items, setItems] = React.useState<SpecItem[]>([]);

  // price picker
  const [priceSearch, setPriceSearch] = React.useState<string>("");
  const [priceItems, setPriceItems] = React.useState<any[]>([]);

  const printRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!dealId) return;
    (async () => {
      setLoading(true);
      const t = await ensureDefaultTemplate();
      setTemplateRec(t);
      const json = t?.template_json && typeof t.template_json === "object" ? t.template_json : DEFAULT_KP_TEMPLATE_V1;
      setTemplate(json);

      // Load last instance for this deal/template
      const inst = await pb
        .collection("kp_instances")
        .getList(1, 1, { filter: `deal_id="${dealId}" && template_id="${t?.id}"`, sort: "-created" })
        .then((r) => r.items[0])
        .catch(() => null);
      if (inst) {
        setInstance(inst);
        setInput(inst.input_json || {});
        setItems((inst.computed_json?.items || inst.input_json?.items || []) as SpecItem[]);
      } else {
        const seeded: any = {
          clientName: company?.name || "",
          clientInn: company?.inn || "",
          clientEmail: company?.email || "",
          endpoints: typeof deal?.endpoints === "number" ? deal.endpoints : "",
          discountPartnerPercent: 0,
          discountManualPercent: 0,
        };
        setInput(seeded);
        setItems([]);
      }
      setLoading(false);
    })();
  }, [dealId]);

  React.useEffect(() => {
    // price items lazy load
    (async () => {
      const q = priceSearch.trim();
      const filter = q ? `product_name~"${q.replace(/"/g, "\\\"")}"` : "";
      const res = await pb
        .collection("price_list_items")
        .getList(1, 30, { sort: "product_name", filter: filter || undefined })
        .catch(() => ({ items: [] as any[] }));
      setPriceItems(res.items || []);
    })();
  }, [priceSearch]);

  const currency = currencyOf(template);
  const vatPercent = vatOf(template);
  const computed = React.useMemo(() => {
    return computeSpecification({
      items,
      currency,
      vatPercent,
      discountPartnerPercent: Number(input?.discountPartnerPercent || 0),
      discountManualPercent: Number(input?.discountManualPercent || 0),
      applyPartnerDiscountFirst: !!template?.calcRules?.applyPartnerDiscountFirst,
    });
  }, [items, currency, vatPercent, input?.discountPartnerPercent, input?.discountManualPercent, template?.calcRules?.applyPartnerDiscountFirst]);

  async function saveDraft() {
    if (!dealId || !templateRec?.id) return;
    const payload = {
      deal_id: dealId,
      template_id: templateRec.id,
      status: "draft",
      version: (instance?.version || 0) + (instance ? 0 : 1),
      input_json: { ...input },
      computed_json: { items, totals: computed.totals },
    };

    const saved = instance?.id
      ? await pb.collection("kp_instances").update(instance.id, payload)
      : await pb.collection("kp_instances").create(payload);

    setInstance(saved);
    if (onTimeline) await onTimeline("kp_draft_saved", "Сохранён черновик КП", { kp_instance_id: saved.id });
  }

  async function addFromPrice(pi: any) {
    const meta = pi.meta || {};
    const vatMode = meta.vat_mode || "with_vat";
    const name = pi.product_name || pi.name || "";
    const price = Number(pi.price || 0);
    // Сейчас храним цену как есть (как в прайсе). vat_mode влияет на интерпретацию, если понадобится.
    const unitPrice = price;
    setItems((prev) => [
      ...prev,
      {
        id: uid("p"),
        name,
        qty: 1,
        unitPrice,
        vatPercent: Number(pi.vat_percent ?? vatPercent),
        source: "price",
        price_list_item_id: pi.id,
      },
    ]);
  }

  function addCustom() {
    setItems((prev) => [
      ...prev,
      {
        id: uid("c"),
        name: "Кастомная позиция",
        qty: 1,
        unitPrice: 0,
        vatPercent,
        source: "custom",
        price_list_item_id: null,
      },
    ]);
  }

  function updateItem(id: string, patch: Partial<SpecItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? ({ ...it, ...patch } as SpecItem) : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function generatePdfAndDownload() {
    if (!printRef.current) return;
    await saveDraft();

    const el = printRef.current;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fit image to page
    const imgProps = (pdf as any).getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    // Simple multi-page handling
    let heightLeft = imgHeight - pageHeight;
    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const clientName = String(input?.clientName || company?.name || "Клиент");
    const fileName = safeFileName(`КП_${clientName}_${dealId}.pdf`);
    pdf.save(fileName);

    if (onTimeline) await onTimeline("kp_pdf_generated", "Сформировано КП (PDF)", { fileName, totals: computed.totals, kp_instance_id: instance?.id || null });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">КП</div>
          <div className="text-xs text-text2 mt-1">Загрузка…</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text2">Загрузка настроек КП…</div>
        </CardContent>
      </Card>
    );
  }

  const sections = template?.ui?.sections || [];
  const requiredMissing = sections
    .flatMap((s: any) => s.fields || [])
    .filter((f: any) => f.required)
    .some((f: any) => {
      const v = input?.[f.id];
      return v === undefined || v === null || String(v).trim() === "";
    });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">КП / Спецификация</div>
              <div className="text-xs text-text2 mt-1">Шаблон задаётся админом централизованно (Parsers/AI → КП)</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge>НДС {vatPercent}%</Badge>
              <Button variant="secondary" onClick={saveDraft}>Сохранить черновик</Button>
              <Button onClick={generatePdfAndDownload} disabled={requiredMissing || !items.length}>Сформировать PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-6 grid gap-4">
              {sections.map((sec: any) => (
                <div key={sec.id} className="rounded-card border border-border bg-white p-3">
                  <div className="text-sm font-semibold">{sec.title}</div>
                  <div className="mt-3 grid gap-3">
                    {(sec.fields || []).map((f: any) => {
                      // we render only basic input types here (pricePicker handled separately)
                      if (f.type === "pricePicker") return null;
                      const val = input?.[f.id] ?? "";
                      const common = {
                        value: String(val),
                        onChange: (e: any) => setInput((p: any) => ({ ...p, [f.id]: e.target.value })),
                        placeholder: f.placeholder || "",
                      };

                      return (
                        <div key={f.id}>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-text2 mb-1">{f.label}{f.required ? " *" : ""}</div>
                          </div>
                          {f.type === "textarea" ? (
                            <textarea className="w-full min-h-[90px] rounded-card border border-[#9CA3AF] bg-white p-3 text-sm" {...common} />
                          ) : f.type === "select" ? (
                            <select className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm" value={String(val)} onChange={(e) => setInput((p: any) => ({ ...p, [f.id]: e.target.value }))}>
                              <option value="">—</option>
                              {(f.options || []).map((o: any) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} {...common} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="rounded-card border border-border bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Позиции (из прайса)</div>
                  <Button variant="secondary" onClick={addCustom}>+ Кастом</Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <Input value={priceSearch} onChange={(e) => setPriceSearch(e.target.value)} placeholder="Поиск по прайсу…" />
                  <div className="max-h-[240px] overflow-auto rounded-card border border-border">
                    {priceItems.map((pi) => (
                      <div key={pi.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border last:border-b-0">
                        <div className="text-sm">
                          <div className="font-medium">{pi.product_name || pi.name}</div>
                          <div className="text-xs text-text2">{Number(pi.price || 0)} {currency}</div>
                        </div>
                        <Button variant="secondary" onClick={() => addFromPrice(pi)}>Добавить</Button>
                      </div>
                    ))}
                    {!priceItems.length ? <div className="px-3 py-4 text-sm text-text2">Ничего не найдено.</div> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-border bg-white p-3">
                <div className="text-sm font-semibold">Текущая спецификация</div>
                <div className="mt-2 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                        <th className="text-left px-3">Наименование</th>
                        <th className="text-right px-3">Кол-во</th>
                        <th className="text-right px-3">Цена</th>
                        <th className="text-right px-3">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="h-11 border-b border-border">
                          <td className="px-3">
                            <Input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                          </td>
                          <td className="px-3 text-right">
                            <Input type="number" value={String(it.qty)} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value || 0) })} />
                          </td>
                          <td className="px-3 text-right">
                            <Input type="number" value={String(it.unitPrice)} onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value || 0) })} />
                          </td>
                          <td className="px-3 text-right">
                            <Button variant="secondary" onClick={() => removeItem(it.id)}>Удалить</Button>
                          </td>
                        </tr>
                      ))}
                      {!items.length ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-sm text-text2">Добавьте позиции из прайса или “Кастом”.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-text2">Итого без НДС</span><span>{computed.totals.subtotal} {currency}</span></div>
                  <div className="flex items-center justify-between mt-1"><span className="text-text2">НДС</span><span>{computed.totals.vat} {currency}</span></div>
                  <div className="flex items-center justify-between mt-2 font-semibold"><span>Итого</span><span>{computed.totals.total} {currency}</span></div>
                </div>
              </div>
            </div>

            <div className="col-span-6 grid gap-2">
              <div className="text-xs text-text2">Предпросмотр PDF (то, что будет скачано)</div>
              <div ref={printRef} className="rounded-card border border-border bg-white">
                <KpPreview template={template} input={input} items={items} dealId={dealId} mode="pdf" />
              </div>
              {requiredMissing ? <div className="text-xs text-danger mt-1">Заполните обязательные поля формы (со звездочкой).</div> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
