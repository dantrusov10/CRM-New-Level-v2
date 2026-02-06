import React from "react";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { pb } from "../../lib/pb";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Combobox, type ComboOption } from "../components/Combobox";

export function CreateDealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState<ComboOption | null>(null);
  const [enrich, setEnrich] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(() => {
    if (open) {
      setName("");
      setCompany(null);
      setEnrich(false);
    }
  }, [open]);

  const loadCompanies = React.useCallback(async (q: string) => {
    const filter = q?.trim() ? `name~"${q.replace(/\"/g, "\\\"")}"` : "";
    const res = await pb.collection("companies").getList(1, 10, { filter: filter || undefined, sort: "name" });
    return res.items.map((c: any) => ({ value: c.id, label: c.name, meta: c }));
  }, []);

  async function submit() {
    if (!name.trim() || !company) return;
    setSaving(true);
    try {
      const stage = await pb
        .collection("settings_funnel_stages")
        .getFirstListItem("position>=0", { sort: "position" })
        .catch(() => null);

      const rec = await pb.collection("deals").create({
        title: name.trim(),
        company_id: company.value,
        stage_id: stage?.id || null,
        responsible_id: (pb.authStore.model as any)?.id || null,
      });

      // log timeline (deal only)
      await pb.collection("timeline").create({
        deal_id: rec.id,
        user_id: (pb.authStore.model as any)?.id,
        action: "create",
        comment: "Сделка создана",
        payload: {},
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      if (enrich) {
        await pb
          .collection("parser_runs")
          .create({
            entity_type: "deal",
            entity_id: rec.id,
            kind: "enrich_6m",
            status: "queued",
          })
          .catch(() => {});

        await pb.collection("timeline").create({
          deal_id: rec.id,
          user_id: (pb.authStore.model as any)?.id,
          action: "enrich",
          comment: "Запущено обогащение за последние 6 месяцев (контакты/медиа/тендеры)",
          payload: { kind: "enrich_6m" },
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      onClose();
      nav(`/deals/${rec.id}`);
    } finally {
      setSaving(false);
    }
  }


  return (
    <Modal open={open} title="Создать сделку" onClose={onClose}>
      <div className="grid gap-3">
        <div>
          <div className="text-xs text-text2 mb-1">Название сделки *</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Пилот IT-инвентаризации / CMDB" />
        </div>
        <div>
          <div className="text-xs text-text2 mb-1">Компания</div>
          <Combobox
            value={company}
            onChange={setCompany}
            placeholder="Начните вводить название компании..."
            loadOptions={loadCompanies}
          />
          <div className="mt-1 text-xs text-text2">Поиск идёт по базе компаний (PocketBase). Можно оставить пустым.</div>
        </div>

        <label className="flex items-center gap-2 text-sm mt-1">
          <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} />
          <span>Обогатить за последние 6 месяцев <Badge className="ml-1">US-01</Badge></span>
        </label>
        {enrich ? (
          <div className="text-xs text-text2">
            Будут запущены парсеры (медиа/тендеры/контакты). В MVP создаётся запись `parser_runs` со статусом `queued`.
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? "Создание..." : "Создать"}</Button>
        </div>
      </div>
    </Modal>
  );
}
