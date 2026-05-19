import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { DealsFilterForm } from "./DealsFilterForm";
import {
  applyDealFiltersToSearchParams,
  dealFilterParamsFromSearchParams,
  type DealFilterParams,
} from "./dealsFilters";

export function DealsFiltersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sp, setSp] = useSearchParams();
  const [draft, setDraft] = React.useState<DealFilterParams>({});

  React.useEffect(() => {
    if (open) setDraft(dealFilterParamsFromSearchParams(sp));
  }, [open, sp]);

  function apply() {
    const next = new URLSearchParams(sp);
    applyDealFiltersToSearchParams(next, draft);
    setSp(next, { replace: true });
    onClose();
  }

  function reset() {
    const next = new URLSearchParams(sp);
    applyDealFiltersToSearchParams(next, {});
    setSp(next, { replace: true });
    onClose();
  }

  return (
    <Modal open={open} title="Фильтры сделок" onClose={onClose} widthClass="max-w-3xl">
      <DealsFilterForm values={draft} onChange={setDraft} />
      <div className="flex gap-2 justify-end pt-4 mt-2 border-t border-border">
        <Button variant="secondary" onClick={reset}>Сбросить</Button>
        <Button onClick={apply}>Применить</Button>
      </div>
    </Modal>
  );
}
