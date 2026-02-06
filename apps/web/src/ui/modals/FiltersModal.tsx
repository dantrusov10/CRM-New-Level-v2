import React from "react";
import { useSearchParams } from "react-router-dom";
import { pb } from "../../lib/pb";
import { useAuth } from "../../app/AuthProvider";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Combobox, type ComboOption } from "../components/Combobox";

type EntityType = "deal" | "company";

function entityByPath(pathname: string): EntityType {
  if (pathname.startsWith("/companies")) return "company";
  return "deal"; // deals + kanban
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

  // current URL filters
  const stageId0 = sp.get("stage") ?? "";
  const ownerId0 = sp.get("owner") ?? "";
  const channel0 = sp.get("channel") ?? "";
  const companyCity0 = sp.get("city") ?? "";
  const companyResp0 = sp.get("responsible") ?? "";

  const [stage, setStage] = React.useState<ComboOption | null>(null);
  const [owner, setOwner] = React.useState<ComboOption | null>(null);
  const [channel, setChannel] = React.useState(channel0);
  const [city, setCity] = React.useState(companyCity0);
  const [responsible, setResponsible] = React.useState<ComboOption | null>(null);

  // presets
  const [presets, setPresets] = React.useState<any[]>([]);
  const [presetsLoading, setPresetsLoading] = React.useState(false);
  const [presetName, setPresetName] = React.useState("");
  const [savingPreset, setSavingPreset] = React.useState(false);

  const loadStages = React.useCallback(async (q: string) => {
    // PocketBase schema: stage_name + position
    const filter = q?.trim() ? `stage_name~"${safeText(q)}"` : "";
    const res = await pb
      .collection("settings_funnel_stages")
      .getList(1, 20, { filter: filter || undefined, sort: "position" });
    return res.items.map((s: any) => ({ value: s.id, label: s.stage_name, meta: s }));
  }, []);

  const loadUsers = React.useCallback(async (q: string) => {
    const filter = q?.trim()
      ? `full_name~"${safeText(q)}" || email~"${safeText(q)}"`
      : "";
    const res = await pb.collection("users").getList(1, 20, { filter: filter || undefined, sort: "full_name" });
    return res.items.map((u: any) => ({ value: u.id, label: u.full_name || u.email, meta: u }));
  }, []);

  React.useEffect(() => {
    if (!open) return;

    // seed local state from URL
    setChannel(channel0);
    setCity(companyCity0);
    setPresetName("");

    // resolve ids -> labels (best-effort)
    (async () => {
      if (entityType === "deal") {
        if (stageId0) {
          const s = await pb.collection("settings_funnel_stages").getOne(stageId0).catch(() => null);
          setStage(s ? { value: s.id, label: (s as any).stage_name ?? (s as any).name ?? "", meta: s } : null);
        } else setStage(null);
        if (ownerId0) {
          const u = await pb.collection("users").getOne(ownerId0).catch(() => null);
          setOwner(u ? { value: u.id, label: u.full_name || u.email, meta: u } : null);
        } else setOwner(null);
      }
      if (entityType === "company") {
        if (companyResp0) {
          const u = await pb.collection("users").getOne(companyResp0).catch(() => null);
          setResponsible(u ? { value: u.id, label: u.full_name || u.email, meta: u } : null);
        } else setResponsible(null);
      }
    })();
  }, [open, entityType, stageId0, ownerId0, channel0, companyCity0, companyResp0]);

  React.useEffect(() => {
    if (!open || !user?.id) return;
    setPresetsLoading(true);
    pb.collection("saved_filters")
      .getList(1, 50, { filter: `entity_type="${entityType}"`, sort: "-created" })
      .then((r) => setPresets(r.items as any))
      .finally(() => setPresetsLoading(false));
  }, [open, user?.id, entityType]);

  function applyToUrl(next: Record<string, string>) {
    const n = new URLSearchParams(sp);
    // wipe known keys for entity
    ["stage", "owner", "channel", "city", "responsible"].forEach((k) => n.delete(k));
    Object.entries(next).forEach(([k, v]) => {
      if (v) n.set(k, v);
    });
    setSp(n, { replace: true });
  }

  const currentFilterJson = React.useMemo(() => {
    if (entityType === "deal") {
      return {
        stage: stage?.value || "",
        owner: owner?.value || "",
        channel: channel || "",
      };
    }
    return {
      city: city || "",
      responsible: responsible?.value || "",
    };
  }, [entityType, stage?.value, owner?.value, channel, city, responsible?.value]);

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
      setPresets(r.items as any);
      setPresetName("");
    } finally {
      setSavingPreset(false);
    }
  }

  async function deletePreset(id: string) {
    await pb.collection("saved_filters").delete(id);
    setPresets((p) => p.filter((x) => x.id !== id));
  }

  function applyPreset(p: any) {
    const f = p.filter_json || {};
    if (entityType === "deal") {
      applyToUrl({ stage: f.stage || "", owner: f.owner || "", channel: f.channel || "" });
    } else {
      applyToUrl({ city: f.city || "", responsible: f.responsible || "" });
    }
    onClose();
  }

  return (
    <Modal open={open} title="Фильтры" onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="text-sm font-semibold">Текущие фильтры</div>

          {entityType === "deal" ? (
            <div className="grid gap-3">
              <div>
                <div className="text-xs text-text2 mb-1">Этап</div>
                <Combobox value={stage} onChange={setStage} placeholder="Любой" loadOptions={loadStages} />
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Ответственный</div>
                <Combobox value={owner} onChange={setOwner} placeholder="Любой" loadOptions={loadUsers} />
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Канал</div>
                <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="например: Партнёр / Прямые / Тендер" />
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div>
                <div className="text-xs text-text2 mb-1">Ответственный</div>
                <Combobox value={responsible} onChange={setResponsible} placeholder="Любой" loadOptions={loadUsers} />
              </div>
              <div>
                <div className="text-xs text-text2 mb-1">Город</div>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="например: Москва" />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                applyToUrl({});
                onClose();
              }}
            >
              Сбросить
            </Button>
            <Button
              onClick={() => {
                if (entityType === "deal") {
                  applyToUrl({ stage: stage?.value || "", owner: owner?.value || "", channel });
                } else {
                  applyToUrl({ city, responsible: responsible?.value || "" });
                }
                onClose();
              }}
            >
              Применить
            </Button>
          </div>
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
