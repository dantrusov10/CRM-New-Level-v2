import React from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";
import { normalizePilotChecklist, pilotCoverage, type PilotChecklist } from "../../../lib/reportBuilder";
import { toast } from "../../../lib/toast";

export function DealPilotChecklist({
  dealId,
  value,
  onSaved,
}: {
  dealId: string;
  value: unknown;
  onSaved?: (next: PilotChecklist) => void;
}) {
  const [draft, setDraft] = React.useState<PilotChecklist>(() => normalizePilotChecklist(value));
  const [saving, setSaving] = React.useState(false);
  const coverage = pilotCoverage(draft);

  React.useEffect(() => {
    setDraft(normalizePilotChecklist(value));
  }, [value, dealId]);

  async function save(next: PilotChecklist) {
    setSaving(true);
    try {
      const payload = { ...next, updated_at: new Date().toISOString() };
      await pb.collection("deals").update(dealId, { pilot_checklist: payload });
      setDraft(payload);
      onSaved?.(payload);
      toast.success("Чеклист пилота сохранён");
    } catch {
      toast.error("Не удалось сохранить чеклист (нужно поле deals.pilot_checklist)");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    const next = {
      ...draft,
      items: draft.items.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
    };
    setDraft(next);
    void save(next);
  }

  function setNote(id: string, note: string) {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.id === id ? { ...x, note } : x)),
    }));
  }

  return (
    <div className="rounded-card border border-border bg-[rgba(255,255,255,0.04)] p-3 grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Чеклист пилота</div>
          <div className="text-xs text-text2 mt-0.5">
            Покрытие требований: {coverage.done}/{coverage.total} ({coverage.pct}%)
          </div>
        </div>
        <Button small variant="secondary" disabled={saving} onClick={() => void save(draft)}>
          Сохранить заметки
        </Button>
      </div>
      <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
        <div className="h-full bg-[rgba(51,215,255,0.75)]" style={{ width: `${coverage.pct}%` }} />
      </div>
      <div className="grid gap-2">
        {draft.items.map((item) => (
          <label key={item.id} className="grid gap-1 rounded-md border border-border bg-[rgba(0,0,0,0.15)] p-2">
            <span className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={item.done} onChange={() => toggle(item.id)} />
              <span className={item.done ? "line-through text-text2" : ""}>{item.label}</span>
            </span>
            <Input
              value={item.note || ""}
              onChange={(e) => setNote(item.id, e.target.value)}
              placeholder="Комментарий / ссылка на артефакт"
              className="h-8 text-xs"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
