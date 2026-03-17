import type { SpecItem } from './types';

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const baseSubtotal = (it.qty || 0) * (it.unitPrice || 0);
    const itemDiscountPercent = it.discountPercent ?? 0;

    let preciseSubtotal = baseSubtotal;
    if (itemDiscountPercent > 0) preciseSubtotal *= 1 - itemDiscountPercent / 100;
    for (const discount of globalDiscounts) {
      if (discount > 0) preciseSubtotal *= 1 - discount / 100;
    }

    const lineVatRate = (it.vatPercent ?? vatPercent) / 100;
    const preciseVat = preciseSubtotal * lineVatRate;
    const preciseTotal = preciseSubtotal + preciseVat;

    return {
      ...it,
      _preciseSubtotal: preciseSubtotal,
      _preciseVat: preciseVat,
      _preciseTotal: preciseTotal,
      lineSubtotal: round2(preciseSubtotal),
      lineVat: round2(preciseVat),
      lineTotal: round2(preciseTotal),
    };
  });

  const subtotalRaw = computedItems.reduce((sum, item) => sum + item._preciseSubtotal, 0);
  const vatRaw = computedItems.reduce((sum, item) => sum + item._preciseVat, 0);
  const totalRaw = subtotalRaw + vatRaw;

  return {
    items: computedItems.map(({ _preciseSubtotal, _preciseVat, _preciseTotal, ...item }) => item),
    totals: {
      subtotal: round2(subtotalRaw),
      vat: round2(vatRaw),
      total: round2(totalRaw),
    },
  };
}
