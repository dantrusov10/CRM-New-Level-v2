import React from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { pb } from "../../../lib/pb";
import { KpPreview } from "./KpPreview";
import { computeSpecification } from "./calc";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";
import { KpStepNav } from "./KpStepNav";
import { KpReadinessCard } from "./KpReadinessCard";
import { DEAL_KP_STEPS, dealWizardSectionKind, fetchKpReadiness, type KpReadiness } from "./kpProcess";
import type { Deal } from "../../../lib/types";
import type { SpecItem, KpInput, KpTemplateConfig, KpTemplateRecord, KpInstanceRecord, PriceListItem, KpSection, KpField } from "./types";

function uid(prefix = "i") {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
}

function currencyOf(template: KpTemplateConfig) {
  return template?.defaults?.currency || "RUB";
}

function vatOf(template: KpTemplateConfig) {
  const v = Number(template?.defaults?.vatPercent ?? 20);
  return Number.isFinite(v) ? v : 20;
}

async function ensureDefaultTemplate() {
  const list = await pb
    .collection("settings_kp_templates")
    .getList(1, 1, { filter: "is_default=true && is_active=true" })
    .catch(() => ({ items: [] as KpTemplateRecord[] }));

  if (list.items[0]) return list.items[0];

  return pb
    .collection("settings_kp_templates")
    .create({
      name: DEFAULT_KP_TEMPLATE_V1.name,
      is_active: true,
      is_default: true,
      template_json: DEFAULT_KP_TEMPLATE_V1,
    })
    .catch(() => null);
}

function renderField(
  f: KpField,
  input: KpInput,
  setInput: React.Dispatch<React.SetStateAction<KpInput>>,
) {
  const val = input?.[f.id] ?? "";
  const common = {
    value: String(val),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setInput((p) => ({ ...p, [f.id]: e.target.value })),
    placeholder: f.placeholder || "",
  };

  return (
    <div key={f.id}>
      <div className="text-xs text-text2 mb-1">
        {f.label}
        {f.required ? " *" : ""}
      </div>
      {f.type === "textarea" ? (
        <textarea className="w-full min-h-[80px] rounded-card border border-[#9CA3AF] bg-white p-3 text-sm" {...common} />
      ) : f.type === "select" ? (
        <select
          className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
          value={String(val)}
          onChange={(e) => setInput((p) => ({ ...p, [f.id]: e.target.value }))}
        >
          <option value="">—</option>
          {(f.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
          {...common}
        />
      )}
    </div>
  );
}

export function DealKpModule({
  deal,
  onTimeline,
}: {
  deal: Deal;
  onTimeline?: (action: string, comment?: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const dealId = deal?.id;
  const company = deal?.expand?.company_id;

  const [loading, setLoading] = React.useState(true);
  const [step, setStep] = React.useState("client");
  const [readiness, setReadiness] = React.useState<KpReadiness | null>(null);
  const [templateRec, setTemplateRec] = React.useState<KpTemplateRecord | null>(null);
  const [template, setTemplate] = React.useState<KpTemplateConfig>(DEFAULT_KP_TEMPLATE_V1);
  const [instance, setInstance] = React.useState<KpInstanceRecord | null>(null);
  const [input, setInput] = React.useState<KpInput>({});
  const [items, setItems] = React.useState<SpecItem[]>([]);
  const [priceSearch, setPriceSearch] = React.useState("");
  const [priceItems, setPriceItems] = React.useState<PriceListItem[]>([]);
  const printRef = React.useRef<HTMLDivElement | null>(null);

  async function refreshReadiness() {
    setReadiness(await fetchKpReadiness());
  }

  React.useEffect(() => {
    if (!dealId) return;
    (async () => {
      setLoading(true);
      const [t, r] = await Promise.all([ensureDefaultTemplate(), fetchKpReadiness()]);
      setReadiness(r);
      setTemplateRec(t);
      const json = t?.template_json && typeof t.template_json === "object" ? t.template_json : DEFAULT_KP_TEMPLATE_V1;
      setTemplate(json);

      const inst = await pb
        .collection("kp_instances")
        .getList(1, 1, { filter: `deal_id="${dealId}" && template_id="${t?.id}"`, sort: "-created" })
        .then((res) => res.items[0])
        .catch(() => null);

      if (inst) {
        setInstance(inst as unknown as KpInstanceRecord);
        setInput(inst.input_json || {});
        setItems((inst.computed_json?.items || inst.input_json?.items || []) as SpecItem[]);
      } else {
        setInput({
          clientName: company?.name || "",
          clientInn: company?.inn || "",
          clientEmail: company?.email || "",
          endpoints: typeof deal?.endpoints === "number" ? deal.endpoints : "",
          discountPartnerPercent: 0,
          discountManualPercent: 0,
        });
        setItems([]);
      }
      setLoading(false);
    })();
  }, [dealId]);

  React.useEffect(() => {
    (async () => {
      const q = priceSearch.trim();
      const filter = q ? `product_name~"${q.replace(/"/g, "\\\"")}"` : "";
      const res = await pb
        .collection("price_list_items")
        .getList(1, 30, { sort: "product_name", filter: filter || undefined })
        .catch(() => ({ items: [] as PriceListItem[] }));
      setPriceItems(res.items || []);
    })();
  }, [priceSearch]);

  const currency = currencyOf(template);
  const vatPercent = vatOf(template);
  const computed = React.useMemo(
    () =>
      computeSpecification({
        items,
        currency,
        vatPercent,
        discountPartnerPercent: Number(input?.discountPartnerPercent || 0),
        discountManualPercent: Number(input?.discountManualPercent || 0),
        applyPartnerDiscountFirst: !!template?.calcRules?.applyPartnerDiscountFirst,
      }),
    [items, currency, vatPercent, input?.discountPartnerPercent, input?.discountManualPercent, template?.calcRules?.applyPartnerDiscountFirst],
  );

  const sections = template?.ui?.sections || [];
  const clientSections = sections.filter((s) => dealWizardSectionKind(s.id) === "client");
  const conditionSections = sections.filter((s) => dealWizardSectionKind(s.id) === "conditions");

  const clientFields = clientSections.flatMap((s) => (s.fields || []).filter((f) => f.type !== "pricePicker"));
  const conditionFields = conditionSections.flatMap((s) => (s.fields || []).filter((f) => f.type !== "pricePicker"));

  const requiredMissing = [...clientFields, ...conditionFields]
    .filter((f) => f.required)
    .some((f) => {
      const v = input?.[f.id];
      return v === undefined || v === null || String(v).trim() === "";
    });

  const stepValid = React.useMemo(() => {
    const m: Record<string, boolean> = {
      client: !clientFields.filter((f) => f.required).some((f) => {
        const v = input?.[f.id];
        return v === undefined || v === null || String(v).trim() === "";
      }),
      items: items.length > 0,
      conditions: true,
      pdf: items.length > 0 && !requiredMissing,
    };
    return m;
  }, [clientFields, conditionFields, input, items, requiredMissing]);

  const completed = React.useMemo(() => {
    const s = new Set<string>();
    if (stepValid.client) s.add("client");
    if (stepValid.items) s.add("items");
    if (stepValid.conditions) s.add("conditions");
    return s;
  }, [stepValid]);

  async function saveDraft() {
    if (!dealId || !templateRec?.id) return;
    const payload = {
      deal_id: dealId,
      template_id: templateRec.id,
      status: "draft" as const,
      version: (instance?.version || 0) + (instance ? 0 : 1),
      input_json: { ...input },
      computed_json: { items, totals: computed.totals },
    };
    const saved = instance?.id
      ? await pb.collection("kp_instances").update(instance.id, payload)
      : await pb.collection("kp_instances").create(payload);
    setInstance(saved as unknown as KpInstanceRecord);
    if (onTimeline) await onTimeline("kp_draft_saved", "Сохранён черновик КП", { kp_instance_id: saved.id });
  }

  async function addFromPrice(pi: PriceListItem) {
    setItems((prev) => [
      ...prev,
      {
        id: uid("p"),
        name: pi.product_name || pi.name || "",
        qty: 1,
        unitPrice: Number(pi.price || 0),
        vatPercent: Number(pi.vat_percent ?? vatPercent),
        source: "price",
        price_list_item_id: pi.id,
      },
    ]);
  }

  function addCustom() {
    setItems((prev) => [
      ...prev,
      { id: uid("c"), name: "Позиция", qty: 1, unitPrice: 0, vatPercent, source: "custom", price_list_item_id: null },
    ]);
  }

  function updateItem(id: string, patch: Partial<SpecItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? ({ ...it, ...patch } as SpecItem) : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function resetFromScratch() {
    setInstance(null);
    setInput({
      clientName: company?.name || "",
      clientInn: company?.inn || "",
      clientEmail: company?.email || "",
      endpoints: typeof deal?.endpoints === "number" ? deal.endpoints : "",
      discountPartnerPercent: 0,
      discountManualPercent: 0,
    });
    setItems([]);
    setStep("client");
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
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    let heightLeft = imgHeight - pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    const clientName = String(input?.clientName || company?.name || "Клиент");
    pdf.save(safeFileName(`КП_${clientName}_${dealId}.pdf`));
    if (onTimeline)
      await onTimeline("kp_pdf_generated", "Сформировано КП (PDF)", {
        totals: computed.totals,
        kp_instance_id: instance?.id || null,
      });
  }

  const stepIndex = DEAL_KP_STEPS.findIndex((s) => s.id === step);
  const prevStep = DEAL_KP_STEPS[stepIndex - 1]?.id;
  const nextStep = DEAL_KP_STEPS[stepIndex + 1]?.id;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-text2">Загрузка мастера КП…</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="neon-accent">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-base font-extrabold">Собрать КП для сделки</div>
              <div className="text-xs text-text2 mt-1">
                4 шага: клиент → позиции → условия → PDF. Черновик сохраняется автоматически при скачивании.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>НДС {vatPercent}%</Badge>
              {instance ? <Badge>Черновик v{instance.version || 1}</Badge> : <Badge>Новое КП</Badge>}
              <Button small variant="secondary" onClick={resetFromScratch} title="Очистить и начать заново">
                <RotateCcw size={14} className="mr-1" />
                С нуля
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <KpStepNav steps={DEAL_KP_STEPS} currentId={step} completedIds={completed} onSelect={setStep} />
          {!readiness?.ready ? (
            <KpReadinessCard readiness={readiness} showAdminLink onRefresh={() => void refreshReadiness()} />
          ) : null}
        </CardContent>
      </Card>

      {step === "client" ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Шаг 1 — Данные клиента</div>
            <div className="text-xs text-text2 mt-1">Подставлены из компании сделки. Исправьте при необходимости.</div>
          </CardHeader>
          <CardContent className="grid gap-4 max-w-xl">
            {clientSections.length ? (
              clientSections.map((sec: KpSection) => (
                <div key={sec.id} className="rounded-card border border-border bg-white p-3 grid gap-3">
                  <div className="text-sm font-semibold">{sec.title}</div>
                  {(sec.fields || [])
                    .filter((f) => f.type !== "pricePicker")
                    .map((f) => renderField(f, input, setInput))}
                </div>
              ))
            ) : (
              <div className="grid gap-3">
                {renderField(
                  { id: "clientName", label: "Компания", type: "text", required: true },
                  input,
                  setInput,
                )}
                {renderField({ id: "clientInn", label: "ИНН", type: "text" }, input, setInput)}
                {renderField({ id: "clientEmail", label: "Email", type: "email", required: true }, input, setInput)}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === "items" ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Шаг 2 — Позиции спецификации</div>
                <div className="text-xs text-text2 mt-1">Найдите в прайсе и нажмите «Добавить». Минимум одна строка.</div>
              </div>
              <Button variant="secondary" onClick={addCustom}>
                + Вручную
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input value={priceSearch} onChange={(e) => setPriceSearch(e.target.value)} placeholder="Поиск по прайсу…" />
            <div className="max-h-[200px] overflow-auto rounded-card border border-border">
              {priceItems.map((pi) => (
                <div
                  key={pi.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0 text-sm">
                    <div className="font-medium truncate">{pi.product_name || pi.name}</div>
                    <div className="text-xs text-text2">
                      {Number(pi.price || 0)} {currency}
                    </div>
                  </div>
                  <Button variant="secondary" className="w-full sm:w-auto shrink-0" onClick={() => addFromPrice(pi)}>
                    Добавить
                  </Button>
                </div>
              ))}
              {!priceItems.length ? (
                <div className="px-3 py-4 text-sm text-text2">Прайс пуст или не найден — загрузите в админке → КП.</div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="h-10 bg-[#EEF1F6] font-semibold text-[#374151]">
                    <th className="text-left px-3">Наименование</th>
                    <th className="text-right px-3 w-16">Кол-во</th>
                    <th className="text-right px-3 w-24">Цена</th>
                    <th className="text-right px-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="px-2 py-1">
                        <Input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          value={String(it.qty)}
                          onChange={(e) => updateItem(it.id, { qty: Number(e.target.value || 0) })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          value={String(it.unitPrice)}
                          onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value || 0) })}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Button variant="secondary" onClick={() => removeItem(it.id)}>
                          ×
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length ? <div className="p-4 text-sm text-text2">Добавьте хотя бы одну позицию.</div> : null}
            </div>
            <div className="text-sm grid gap-1 max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-text2">Итого</span>
                <span className="font-semibold">
                  {computed.totals.total} {currency}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "conditions" ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Шаг 3 — Условия и комментарий</div>
            <div className="text-xs text-text2 mt-1">Попадут в PDF, если блок «Условия» включён в шаблоне.</div>
          </CardHeader>
          <CardContent className="grid gap-4 max-w-xl">
            {conditionSections.length ? (
              conditionSections.map((sec) => (
                <div key={sec.id} className="rounded-card border border-border bg-white p-3 grid gap-3">
                  <div className="text-sm font-semibold">{sec.title}</div>
                  {(sec.fields || [])
                    .filter((f) => f.type !== "pricePicker")
                    .map((f) => renderField(f, input, setInput))}
                </div>
              ))
            ) : (
              <div className="text-sm text-text2">Дополнительных полей нет — можно перейти к PDF.</div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === "pdf" ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Шаг 4 — Проверка и PDF</div>
            <div className="text-xs text-text2 mt-1">Так увидит клиент. Сначала сохраните черновик, затем скачайте файл.</div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div ref={printRef} className="rounded-card border border-border bg-white overflow-x-auto">
              <KpPreview template={template} input={input} items={items} dealId={dealId || ""} mode="pdf" />
            </div>
            {requiredMissing ? (
              <div className="text-sm text-danger">Заполните обязательные поля на шагах 1 и 3.</div>
            ) : null}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void saveDraft()}>
                Сохранить черновик
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => void generatePdfAndDownload()}
                disabled={!items.length || requiredMissing || !readiness?.ready}
              >
                Скачать PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 sticky bottom-0 py-2 bg-[rgba(15,23,42,0.85)] backdrop-blur-sm rounded-card px-2">
        <Button
          variant="secondary"
          disabled={!prevStep}
          onClick={() => prevStep && setStep(prevStep)}
          className="w-full sm:w-auto"
        >
          <ArrowLeft size={16} className="mr-1" />
          Назад
        </Button>
        <Button
          disabled={!nextStep || (step === "client" && !stepValid.client) || (step === "items" && !stepValid.items)}
          onClick={() => nextStep && setStep(nextStep)}
          className="w-full sm:w-auto"
        >
          Далее
          <ArrowRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
