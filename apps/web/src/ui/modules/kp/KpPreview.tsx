import React from "react";
import { computeSpecification } from "./calc";
import { documentTitle, getDocumentType } from "./kpDocumentMeta";
import { designCssVars, normalizePdfDesign } from "./kpDesign";
import { ensurePdfBlocks, type KpPdfBlock } from "./kpPdfBlocks";
import type { SpecItem, KpInput, KpTemplateConfig } from "./types";
import "./kpDocument.css";

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
  mode = "document",
}: {
  template: KpTemplateConfig;
  input: KpInput;
  items: SpecItem[];
  dealId: string;
  mode?: "manager" | "pdf" | "document";
}) {
  const isDocument = mode === "pdf" || mode === "document";
  const currency = template?.defaults?.currency || "RUB";
  const vatPercent = Number(template?.defaults?.vatPercent ?? 20);
  const resolvedDesign = normalizePdfDesign(template);
  const docType = getDocumentType(template);
  const docTitle = documentTitle(docType);
  const showVatNote = template?.specification?.showVatColumn !== false;

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
  const cols = (template?.specification?.columns || []).filter((c) => c.optional !== true);
  const showQty = cols.some((c) => c.key === "qty") || !cols.length;
  const showPrice = cols.some((c) => c.key === "unitPrice") || !cols.length;
  const showSum = cols.some((c) => c.key === "lineTotal") || !cols.length;

  const fieldValue = (fieldId: string) => {
    const v = input?.[fieldId];
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  };

  const rootClass = isDocument
    ? [
        "kp-document-root",
        `kp-layout-${resolvedDesign.layoutStyle}`,
        `kp-font-${resolvedDesign.fontScale}`,
        `kp-table-${resolvedDesign.tableStyle}`,
      ].join(" ")
    : "";

  function renderBlock(blk: KpPdfBlock) {
    if (!isDocument) {
      return renderBlockLegacy(blk);
    }

    switch (blk.type) {
      case "header":
        return (
          <header key={blk.id} className="kp-doc-header">
            <div className="flex justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="kp-doc-title">{docTitle}</div>
                <div className="kp-doc-company">{b.companyName || "—"}</div>
                <div className="kp-doc-client">{fieldValue("clientName")}</div>
                <div className="kp-doc-meta">№ сделки {dealId}</div>
                {resolvedDesign.showValidityLine ? (
                  <div className="kp-doc-meta">Срок действия: {resolvedDesign.validityDays} календарных дней</div>
                ) : null}
              </div>
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="" className="h-12 max-w-[140px] object-contain shrink-0" />
              ) : null}
            </div>
            {b.footerText ? <div className="kp-doc-meta mt-2">{b.footerText}</div> : null}
          </header>
        );

      case "technical": {
        const text =
          String(input?.technicalIntro || "").trim() ||
          String(b.technicalIntroDefault || "").trim() ||
          "";
        if (!text) return null;
        return (
          <section key={blk.id} className="kp-doc-technical">
            <div className="kp-doc-section-title">{blk.title || "Техническое описание"}</div>
            {text}
          </section>
        );
      }

      case "client_cards":
        return (
          <div key={blk.id} className="kp-doc-info-grid">
            <div className="kp-doc-info-cell">
              <div className="kp-doc-info-label">Email</div>
              <div className="kp-doc-info-value">{fieldValue("clientEmail")}</div>
            </div>
            <div className="kp-doc-info-cell">
              <div className="kp-doc-info-label">ИНН</div>
              <div className="kp-doc-info-value">{fieldValue("clientInn")}</div>
            </div>
          </div>
        );

      case "specification_table":
        return (
          <section key={blk.id}>
            <div className="kp-doc-section-title">{blk.title || specTitle}</div>
            <table className="kp-doc-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  {showQty ? <th className="num">Кол-во</th> : null}
                  {showPrice ? <th className="num">Цена</th> : null}
                  {showSum ? <th className="num">Сумма</th> : null}
                </tr>
              </thead>
              <tbody>
                {computed.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    {showQty ? <td className="num">{it.qty}</td> : null}
                    {showPrice ? <td className="num">{formatMoney(it.unitPrice, currency)}</td> : null}
                    {showSum ? <td className="num">{formatMoney(it.lineTotal, currency)}</td> : null}
                  </tr>
                ))}
                {!computed.items.length ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#9ca3af", padding: 16 }}>
                      Позиции не добавлены
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {showVatNote ? <div className="text-[9pt] text-[#6b7280] mb-2">НДС {vatPercent}%</div> : null}
          </section>
        );

      case "totals":
        return (
          <div key={blk.id} className="kp-doc-totals">
            <div className="kp-doc-totals-row">
              <span>Итого без НДС</span>
              <span>{formatMoney(computed.totals.subtotal, currency)}</span>
            </div>
            <div className="kp-doc-totals-row">
              <span>НДС</span>
              <span>{formatMoney(computed.totals.vat, currency)}</span>
            </div>
            <div className="kp-doc-totals-row total">
              <span>Итого к оплате</span>
              <span>{formatMoney(computed.totals.total, currency)}</span>
            </div>
          </div>
        );

      case "conditions": {
        const pay = String(input?.paymentTerms || "");
        const payLabel = PAYMENT_LABELS[pay] || pay || "—";
        return (
          <div key={blk.id} className="kp-doc-conditions">
            <div className="kp-doc-section-title">{blk.title || "Условия"}</div>
            <div>
              <strong>Оплата:</strong> {payLabel}
            </div>
            <div className="mt-1">
              <strong>Поставка / старт:</strong> {fieldValue("deliveryDate")}
            </div>
            {input?.comment ? (
              <div className="mt-2 whitespace-pre-wrap">
                <strong>Комментарий:</strong> {String(input.comment)}
              </div>
            ) : null}
          </div>
        );
      }

      case "signature":
        return (
          <footer key={blk.id} className="kp-doc-footer">
            {b.disclaimer ? <div className="whitespace-pre-wrap">{b.disclaimer}</div> : null}
            {b.signature?.name ? (
              <div className="kp-doc-signature">
                <div className="kp-doc-signature-name">{b.signature.name}</div>
                {b.signature.title ? <div>{b.signature.title}</div> : null}
                <div className="text-[9pt] text-[#6b7280] mt-1">
                  {[b.signature.phone, b.signature.email].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : null}
          </footer>
        );

      default:
        return null;
    }
  }

  function renderBlockLegacy(blk: KpPdfBlock) {
    switch (blk.type) {
      case "header":
        return (
          <div key={blk.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
            <div>
              <div className="text-xs text-text2">Коммерческое предложение</div>
              <div className="text-lg font-semibold" style={{ color: resolvedDesign.accentColor }}>
                {b.companyName || "—"}
              </div>
              <div className="text-sm mt-1">{fieldValue("clientName")}</div>
            </div>
            {b.logoUrl ? <img src={b.logoUrl} alt="logo" className="h-10" /> : null}
          </div>
        );
      case "specification_table":
        return (
          <div key={blk.id}>
            <div className="text-sm font-semibold mb-2">{blk.title || specTitle}</div>
            <div className="text-sm text-text2">{computed.items.length} поз.</div>
          </div>
        );
      default:
        return null;
    }
  }

  const inner = (
    <>
      {blocks.map((blk) => renderBlock(blk))}
      {!blocks.length ? (
        <div className="py-8 text-center text-sm text-[#6b7280]">Включите разделы документа слева</div>
      ) : null}
    </>
  );

  if (isDocument) {
    return (
      <div className={`${rootClass} p-8 sm:p-10`} style={designCssVars(template)}>
        {inner}
      </div>
    );
  }

  return <div className="grid gap-4 p-3">{inner}</div>;
}
