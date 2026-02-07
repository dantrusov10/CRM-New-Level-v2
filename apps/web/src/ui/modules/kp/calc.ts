import type { SpecItem } from "./types";

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export function computeSpecification(params: {
  items: SpecItem[];
  currency: string;
  vatPercent: number;
  discountPartnerPercent?: number;
  discountManualPercent?: number;
  applyPartnerDiscountFirst?: boolean;
}) {
  const {
    items,
    vatPercent,
    discountPartnerPercent = 0,
    discountManualPercent = 0,
    applyPartnerDiscountFirst = true,
  } = params;

  const globalDiscounts = applyPartnerDiscountFirst
    ? [discountPartnerPercent, discountManualPercent]
    : [discountManualPercent, discountPartnerPercent];

  const computedItems = items.map((it) => {
    const base = (it.qty || 0) * (it.unitPrice || 0);
    const itemDisc = it.discountPercent ?? 0;

    let subtotal = base;
    // item discount first
    if (itemDisc > 0) subtotal = subtotal * (1 - itemDisc / 100);
    // global discounts
    for (const d of globalDiscounts) {
      if (d > 0) subtotal = subtotal * (1 - d / 100);
    }

    const lineVat = (it.vatPercent ?? vatPercent) / 100;
    const vat = subtotal * lineVat;
    const total = subtotal + vat;

    return {
      ...it,
      lineSubtotal: round2(subtotal),
      lineVat: round2(vat),
      lineTotal: round2(total),
    };
  });

  const subtotal = round2(computedItems.reduce((s, it: any) => s + (it.lineSubtotal || 0), 0));
  const vat = round2(computedItems.reduce((s, it: any) => s + (it.lineVat || 0), 0));
  const total = round2(subtotal + vat);

  return {
    items: computedItems,
    totals: { subtotal, vat, total },
  };
}
