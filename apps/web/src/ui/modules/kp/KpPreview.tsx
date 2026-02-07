import React from "react";
import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import type { SpecItem } from "./types";
import { computeSpecification } from "./calc";

function formatMoney(v: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + ` ${currency}`;
  } catch {
    return `${v} ${currency}`;
  }
}

export function KpPreview({
  template,
  input,
  items,
  dealId,
  mode,
}: {
  template: any;
  input: any;
  items: SpecItem[];
  dealId: string;
  mode: "manager" | "pdf";
}) {
  const currency = template?.defaults?.currency || "RUB";
  const vatPercent = Number(template?.defaults?.vatPercent ?? 20);

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
    [items, currency, vatPercent, partner, manual, template?.calcRules?.applyPartnerDiscountFirst]
  );

  const b = template?.branding || {};
  const title = template?.specification?.title || "Спецификация";

  const fieldValue = (fieldId: string) => {
    const v = input?.[fieldId];
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  };

  return (
    <div className={mode === "pdf" ? "bg-white p-6" : ""}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-text2">Коммерческое предложение</div>
          <div className="text-lg font-semibold" style={{ color: b.primaryColor || undefined }}>
            {b.companyName || "—"}
          </div>
          <div className="text-sm mt-1">{fieldValue("clientName")}</div>
          <div className="text-xs text-text2 mt-1">Сделка: {dealId}</div>
        </div>
        <div className="text-right">
          {b.logoUrl ? <img src={b.logoUrl} alt="logo" className="h-10 inline-block" /> : null}
          <div className="text-xs text-text2">{b.footerText || ""}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-xs text-text2">Email</div>
          <div className="text-sm">{fieldValue("clientEmail")}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-text2">ИНН</div>
          <div className="text-sm">{fieldValue("clientInn")}</div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <Badge>НДС {vatPercent}%</Badge>
        </div>

        <div className="mt-2 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                <th className="text-left px-3">Наименование</th>
                <th className="text-right px-3">Кол-во</th>
                <th className="text-right px-3">Цена</th>
                <th className="text-right px-3">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {computed.items.map((it: any) => (
                <tr key={it.id} className="h-11 border-b border-border">
                  <td className="px-3">{it.name}</td>
                  <td className="px-3 text-right text-text2">{it.qty}</td>
                  <td className="px-3 text-right text-text2">{formatMoney(it.unitPrice, currency)}</td>
                  <td className="px-3 text-right font-medium">{formatMoney(it.lineTotal, currency)}</td>
                </tr>
              ))}
              {!computed.items.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-sm text-text2">Пока нет позиций.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
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
      </div>

      <div className="mt-6 text-xs text-text2 whitespace-pre-wrap">{b.disclaimer || ""}</div>
      {b.signature?.name ? (
        <div className="mt-4 text-sm">
          <div className="font-medium">{b.signature.name}</div>
          <div className="text-xs text-text2">{b.signature.title || ""}</div>
          <div className="text-xs text-text2 mt-1">{[b.signature.phone, b.signature.email].filter(Boolean).join(" · ")}</div>
        </div>
      ) : null}
    </div>
  );
}
