import React from "react";
import { useSearchParams } from "react-router-dom";
import { pb } from "../../lib/pb";
import { useAuth } from "../../app/AuthProvider";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Combobox, type ComboOption } from "../components/Combobox";
import { notifyPbError } from "../../lib/pbError";
import { DealsFilterForm } from "../pages/deals/DealsFilterForm";
import {
  applyDealFiltersToSearchParams,
  dealFilterParamsFromSearchParams,
  type DealFilterParams,
} from "../pages/deals/dealsFilters";

type EntityType = "deal" | "company";

type UserOptionRecord = { id: string; full_name?: string; email?: string };
type SavedFilterRecord = {
  id: string;
  name?: string;
  filter_json?: Record<string, string>;
};

function entityByPath(pathname: string): EntityType {
  if (pathname.startsWith("/companies")) return "company";
  return "deal";
}

function safeText(v: string) {
  return v.replace(/\"/g, "\\\"");
}

export function FiltersModal({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const entityType = entityByPath(pathname);
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();

  const companyCity0 = sp.get("city") ?? "";
  const companyResp0 = sp.get("responsible") ?? "";

  const [dealDraft, setDealDraft] = React.useState<DealFilterParams>({});
  const [city, setCity] = React.useState(companyCity0);
  const [responsible, setResponsible] = React.useState<ComboOption | null>(null);

  const [presets, setPresets] = React.useState<SavedFilterRecord[]>([]);
  const [presetsLoading, setPresetsLoading] = React.useState(false);
  const [presetName, setPresetName] = React.useState("");
  const [savingPreset, setSavingPreset] = React.useState(false);

  const loadUsers = React.useCallback(async (q: string) => {
    const filter = q?.trim() ? `full_name~"${safeText(q)}" || email~"${safeText(q)}"` : "";
    const res = await pb.collection("users").getList(1, 20, { filter: filter || undefined, sort: "full_name" });
    return res.items.map((u) => {
      const rec = u as unknown as UserOptionRecord;
      return { value: rec.id, label: rec.full_name || rec.email || "", meta: rec };
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setPresetName("");
    if (entityType === "deal") setDealDraft(dealFilterParamsFromSearchParams(sp));
    else {
      setCity(companyCity0);
      (async () => {
        if (companyResp0) {
          const u = (await pb.collection("users").getOne(companyResp0).catch(() => null)) as UserOptionRecord | null;
          setResponsible(u ? { value: u.id, label: u.full_name || u.email || "", meta: u } : null);
        } else setResponsible(null);
      })();
    }
  }, [open, entityType, sp, companyCity0, companyResp0]);

  React.useEffect(() => {
    if (!open || !user?.id) return;
    setPresetsLoading(true);
    pb.collection("saved_filters")
      .getList(1, 50, { filter: `entity_type="${entityType}"`, sort: "-created" })
      .then((r) => setPresets(r.items as SavedFilterRecord[]))
      .finally(() => setPresetsLoading(false));
  }, [open, user?.id, entityType]);

  function applyCompanyToUrl(next: Record<string, string>) {
    const n = new URLSearchParams(sp);
    ["city", "responsible"].forEach((k) => n.delete(k));
    Object.entries(next).forEach(([k, v]) => { if (v) n.set(k, v); });
    n.set("page", "1");
    setSp(n, { replace: true });
  }

  const currentFilterJson = React.useMemo(() => {
    if (entityType === "deal") return dealDraft as Record<string, string>;
    return { city: city || "", responsible: responsible?.value || "" };
  }, [entityType, dealDraft, city, responsible?.value]);

  async function savePreset() {
    if (!user?.id) return;
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      await pb.collection("saved_filters").create({
        user_id: user.id,
        entity_type: entityType,
        name: presetName.trim(),
        filter_json: currentFilterJson,
        sort_json: null,
        created_at: new Date().toISOString(),
      });
      const r = await pb.collection("saved_filters").getList(1, 50, { filter: `entity_type="${entityType}"`, sort: "-created" });
      setPresets(r.items as SavedFilterRecord[]);
      setPresetName("");
    } catch (e) {
      notifyPbError(e, "Не удалось сохранить пресет");
    } finally {
      setSavingPreset(false);
    }
  }

  async function deletePreset(id: string) {
    try {
      await pb.collection("saved_filters").delete(id);
      setPresets((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      notifyPbError(e, "Не удалось удалить пресет");
    }
  }

  function applyPreset(p: SavedFilterRecord) {
    const f = p.filter_json || {};
    if (entityType === "deal") {
      const next = new URLSearchParams(sp);
      applyDealFiltersToSearchParams(next, f);
      setSp(next, { replace: true });
    } else {
      applyCompanyToUrl({ city: f.city || "", responsible: f.responsible || "" });
    }
    onClose();
  }

  function applyDeal() {
    const next = new URLSearchParams(sp);
    applyDealFiltersToSearchParams(next, dealDraft);
    setSp(next, { replace: true });
    onClose();
  }

  function resetDeal() {
    const next = new URLSearchParams(sp);
    applyDealFiltersToSearchParams(next, {});
    setSp(next, { replace: true });
    onClose();
  }

  return (
    <Modal
      open={open}
      title={entityType === "deal" ? "Фильтры сделок" : "Фильтры компаний"}
      onClose={onClose}
      widthClass={entityType === "deal" ? "max-w-3xl" : "max-w-2xl"}
    >
      <div className="grid gap-5">
        <div className="grid gap-3">
          {entityType === "deal" ? (
            <>
              <DealsFilterForm values={dealDraft} onChange={setDealDraft} />
              <div className="flex gap-2 justify-end pt-1 border-t border-border">
                <Button variant="secondary" onClick={resetDeal}>Сбросить</Button>
                <Button onClick={applyDeal}>Применить</Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-text2 mb-1">Ответственный</div>
                <Combobox value={responsible} onChange={setResponsible} placeholder="Любой" loadOptions={loadUsers} />
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Город</div>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="например: Москва" />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" onClick={() => { applyCompanyToUrl({}); onClose(); }}>Сбросить</Button>
                <Button onClick={() => { applyCompanyToUrl({ city, responsible: responsible?.value || "" }); onClose(); }}>Применить</Button>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Сохранённые пресеты</div>
            <div className="text-xs text-text2">{entityType === "deal" ? "Сделки" : "Компании"}</div>
          </div>

          <div className="flex gap-2">
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Название пресета" />
            <Button onClick={savePreset} disabled={savingPreset || !presetName.trim()}>
              {savingPreset ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>

          {presetsLoading ? (
            <div className="text-sm text-text2">Загрузка пресетов...</div>
          ) : presets.length ? (
            <div className="border border-border rounded-card overflow-hidden">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
                  <button type="button" className="text-sm font-medium hover:underline" onClick={() => applyPreset(p)}>
                    {p.name}
                  </button>
                  <button type="button" className="text-xs text-text2 hover:text-danger" onClick={() => deletePreset(p.id)}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-text2">Пока нет сохранённых фильтров.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
