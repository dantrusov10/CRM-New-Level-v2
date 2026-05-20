import React from "react";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import type { SpecItem, KpInput, KpTemplateConfig } from "./types";
import { computeSpecification } from "./calc";
import { ensurePdfBlocks, type KpPdfBlock } from "./kpPdfBlocks";

function formatMoney(v: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + ` ${currency}`;
  } catch {
    return `${v} ${currency}`;
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  prepay100: "100% предоплата",
  split50_50: "50/50",
  postpay: "Постоплата",
};

export function KpPreview({
  template,
  input,
  items,
  dealId,
  mode,
}: {
  template: KpTemplateConfig;
  input: KpInput;
  items: SpecItem[];
  dealId: string;
  mode: "manager" | "pdf";
}) {
  const currency = template?.defaults?.currency || "RUB";
  const vatPercent = Number(template?.defaults?.vatPercent ?? 20);

  const pdfDesign = template?.pdfDesign || {};
  const paperBg = pdfDesign.paperBg || "#ffffff";
  const textColor = pdfDesign.textColor || "#111827";
  const tableHeaderBg = pdfDesign.tableHeaderBg || "#EEF1F6";
  const tableHeaderText = pdfDesign.tableHeaderText || "#374151";

  const partner = Number(input?.discountPartnerPercent || 0);
  const manual = Number(input?.discountManualPercent || 0);
  const computed = React.useMemo(
    () =>
      computeSpecification({
        items,
        currency,
        vatPercent,
        discountPartnerPercent: partner,
        discountManualPercent: manual,
        applyPartnerDiscountFirst: !!template?.calcRules?.applyPartnerDiscountFirst,
      }),
    [items, currency, vatPercent, partner, manual, template?.calcRules?.applyPartnerDiscountFirst],
  );

  const b = template?.branding || {};
  const specTitle = template?.specification?.title || "Спецификация";
  const blocks = React.useMemo(() => ensurePdfBlocks(template).filter((blk) => blk.enabled), [template]);

  const fieldValue = (fieldId: string) => {
    const v = input?.[fieldId];
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  };

  function renderBlock(blk: KpPdfBlock) {
    switch (blk.type) {
      case "header":
        return (
          <div key={blk.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs text-text2">Коммерческое предложение</div>
              <div className="text-lg font-semibold" style={{ color: b.primaryColor || undefined }}>
                {b.companyName || "—"}
              </div>
              <div className="text-sm mt-1">{fieldValue("clientName")}</div>
              <div className="text-xs text-text2 mt-1">Сделка: {dealId}</div>
            </div>
            <div className="text-left sm:text-right">
              {b.logoUrl ? <img src={b.logoUrl} alt="logo" className="h-10 inline-block" /> : null}
              <div className="text-xs text-text2 mt-1">{b.footerText || ""}</div>
            </div>
          </div>
        );

      case "client_cards":
        return (
          <div key={blk.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="text-xs text-text2">Email</div>
              <div className="text-sm">{fieldValue("clientEmail")}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-text2">ИНН</div>
              <div className="text-sm">{fieldValue("clientInn")}</div>
            </Card>
          </div>
        );

      case "specification_table":
        return (
          <div key={blk.id}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{blk.title || specTitle}</div>
              <Badge>НДС {vatPercent}%</Badge>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr
                    className="h-10 font-semibold"
                    style={
                      mode === "pdf"
                        ? { background: tableHeaderBg, color: tableHeaderText }
                        : { background: "#EEF1F6", color: "#374151" }
                    }
                  >
                    <th className="text-left px-3">Наименование</th>
                    <th className="text-right px-3">Кол-во</th>
                    <th className="text-right px-3">Цена</th>
                    <th className="text-right px-3">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.items.map((it) => (
                    <tr key={it.id} className="h-11 border-b border-border">
                      <td className="px-3">{it.name}</td>
                      <td className="px-3 text-right text-text2">{it.qty}</td>
                      <td className="px-3 text-right text-text2">{formatMoney(it.unitPrice, currency)}</td>
                      <td className="px-3 text-right font-medium">{formatMoney(it.lineTotal, currency)}</td>
                    </tr>
                  ))}
                  {!computed.items.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-sm text-text2">
                        Пока нет позиций.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "totals":
        return (
          <div key={blk.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div />
            <div className="rounded-card border border-border bg-rowHover p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text2">Итого без НДС</span>
                <span>{formatMoney(computed.totals.subtotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-text2">НДС</span>
                <span>{formatMoney(computed.totals.vat, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 font-semibold">
                <span>Итого</span>
                <span>{formatMoney(computed.totals.total, currency)}</span>
              </div>
            </div>
          </div>
        );

      case "conditions": {
        const pay = String(input?.paymentTerms || "");
        const payLabel = PAYMENT_LABELS[pay] || pay || "—";
        return (
          <div key={blk.id} className="rounded-card border border-border bg-rowHover p-3">
            <div className="text-sm font-semibold mb-2">{blk.title || "Условия"}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-text2">Оплата: </span>
                {payLabel}
              </div>
              <div>
                <span className="text-text2">Поставка / старт: </span>
                {fieldValue("deliveryDate")}
              </div>
            </div>
            {input?.comment ? (
              <div className="mt-2 text-sm whitespace-pre-wrap">
                <span className="text-text2">Комментарий: </span>
                {String(input.comment)}
              </div>
            ) : null}
          </div>
        );
      }

      case "signature":
        return (
          <div key={blk.id}>
            <div className="text-xs text-text2 whitespace-pre-wrap">{b.disclaimer || ""}</div>
            {b.signature?.name ? (
              <div className="mt-4 text-sm">
                <div className="font-medium">{b.signature.name}</div>
                <div className="text-xs text-text2">{b.signature.title || ""}</div>
                <div className="text-xs text-text2 mt-1">
                  {[b.signature.phone, b.signature.email].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div
      className={mode === "pdf" ? "p-4 sm:p-6" : ""}
      style={mode === "pdf" ? { background: paperBg, color: textColor } : undefined}
    >
      <div className="grid gap-4 sm:gap-6">
        {blocks.map((blk) => renderBlock(blk))}
        {!blocks.length ? (
          <div className="text-sm text-text2 py-6 text-center">В PDF не выбран ни один блок. Включите блоки в конструкторе.</div>
        ) : null}
      </div>
    </div>
  );
}
