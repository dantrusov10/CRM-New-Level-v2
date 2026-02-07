import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";

type FunnelStage = {
  id: string;
  stage_name: string;
  position?: number;
  color?: string;
  active?: boolean;
  is_final?: boolean;
  final_type?: "none" | "won" | "lost";
  default_prob?: number;
};

function normalizeStage(raw: any): Partial<FunnelStage> {
  // поддержка старого формата (name/order/win/loss) + нового (stage_name/position/won/lost)
  const stage_name = raw.stage_name ?? raw.name ?? "";
  const position = Number(raw.position ?? raw.order ?? 0);
  const color = raw.color ?? "#004EEB";

  let final_type: any = raw.final_type ?? "none";
  if (final_type === "win") final_type = "won";
  if (final_type === "loss") final_type = "lost";
  if (!["none", "won", "lost"].includes(final_type)) final_type = "none";

  const is_final = !!raw.is_final;
  const active = raw.active ?? true;

  const default_prob =
    raw.default_prob === undefined || raw.default_prob === null || raw.default_prob === ""
      ? undefined
      : Number(raw.default_prob);

  return { stage_name, position, color, is_final, final_type, active, default_prob };
}


async function createStageSafe(stage: Omit<FunnelStage, "id"> & { id?: string }) {
  // 1) Базовый payload — без технических полей
  const basePayload: any = {
    stage_name: String(stage.stage_name ?? "").trim(),
    position: Number(stage.position ?? 0),
    color: stage.color ?? "#004EEB",
    active: stage.active ?? true,
    is_final: stage.is_final ?? false,
    final_type: stage.final_type ?? "none",
    default_prob: stage.default_prob ?? null,
  };

  // 2) Первая попытка — без settings_id (так правильно для схем, где его нет)
  try {
    return await pb.collection("settings_funnel_stages").create(basePayload);
  } catch (e: any) {
    // 3) Если это не 400 — просто пробрасываем ошибку
    if (e?.status !== 400) throw e;

    // 4) Если PocketBase требует settings_id — пробуем найти "настройки" и повторить
    const msg = String(e?.data?.message ?? e?.message ?? "").toLowerCase();
    const dataErr = e?.data?.data ?? {};
    const needsSettingsId =
      msg.includes("settings_id") ||
      Object.keys(dataErr).some((k) => k.toLowerCase().includes("settings_id"));

    if (!needsSettingsId) throw e;

    // Важно: 404 по коллекции настроек НЕ должен ломать создание — просто пропускаем
    const candidates = ["settings", "app_settings", "settings_main", "settings_core", "settings_funnel"];
    let settingsId: string | null = null;

    for (const col of candidates) {
      try {
        const list = await pb.collection(col).getList(1, 1, { sort: "-created" });
        if (list?.items?.length) {
          settingsId = list.items[0].id;
          break;
        }
      } catch (err: any) {
        // 404 = коллекции нет, это ок
        if (err?.status === 404) continue;
        continue;
      }
    }

    if (!settingsId) throw e;

    return await pb
      .collection("settings_funnel_stages")
      .create({ ...basePayload, settings_id: settingsId });
  }
}

export function AdminFunnelPage() {
  const [stages, setStages] = React.useState<FunnelStage[]>([]);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#004EEB");

  async function load() {
    // PocketBase schema: stage_name + position
    const s = await pb.collection("settings_funnel_stages").getFullList({ sort: "position" });
    setStages(s as any);
  }
  React.useEffect(() => {
    load();
  }, []);

  async function addStage() {
    const position = stages.length ? Math.max(...stages.map((x) => Number(x.position ?? 0))) + 1 : 1;
    await createStageSafe({
      stage_name: name.trim(),
      color,
      position,
      active: true,
      is_final: false,
      final_type: "none",
    });
    setName("");
    load();
  }

  async function updateStage(id: string, data: any) {
    await pb.collection("settings_funnel_stages").update(id, data);
    load();
  }

  async function removeStage(id: string) {
    await pb.collection("settings_funnel_stages").delete(id);
    load();
  }

  async function exportJson() {
    // экспортируем в человекочитаемом формате (без технических полей PB)
    const payload = stages
      .slice()
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((s) => ({
        stage_name: s.stage_name,
        position: s.position ?? 0,
        color: s.color ?? "#004EEB",
        active: s.active ?? true,
        is_final: s.is_final ?? false,
        final_type: s.final_type ?? "none",
        default_prob: s.default_prob ?? null,
      }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "funnel_stages.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    const txt = await file.text();
    const arr = JSON.parse(txt);

    const normalized: Partial<FunnelStage>[] = Array.isArray(arr) ? arr.map(normalizeStage) : [];

    // naive MVP: очистить и перезаписать
    for (const s of stages) await pb.collection("settings_funnel_stages").delete(s.id).catch(() => {});
    for (const s of normalized) {
      if (!s.stage_name?.trim()) continue;
      await createStageSafe({
        stage_name: s.stage_name.trim(),
        position: s.position ?? 0,
        color: s.color ?? "#004EEB",
        active: s.active ?? true,
        is_final: s.is_final ?? false,
        final_type: s.is_final ? (s.final_type ?? "won") : "none",
        default_prob: s.default_prob ?? null,
      });
    }
    load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Воронка продаж</div>
            <div className="text-xs text-text2 mt-1">Этапы: название, порядок, цвет, финальность + импорт/экспорт шаблона</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportJson}>
              Экспорт
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                }}
              />
              <Button variant="secondary">Импорт</Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_140px_120px] gap-2 items-end">
            <div>
              <div className="text-xs text-text2 mb-1">Название этапа</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Квалификация" />
            </div>
            <div>
              <div className="text-xs text-text2 mb-1">Цвет</div>
              <input
                type="color"
                className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-2"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <Button onClick={addStage} disabled={!name.trim()}>
              Добавить
            </Button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  <th className="text-left px-3">Порядок</th>
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Цвет</th>
                  <th className="text-left px-3">Финальный</th>
                  <th className="text-left px-3">Тип</th>
                  <th className="text-left px-3">Вероятность (по умолч.)</th>
                  <th className="text-right px-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.id} className="h-11 border-b border-border">
                    <td className="px-3 w-[110px]">
                      <Input
                        value={String(s.position ?? 0)}
                        onChange={(e) => updateStage(s.id, { position: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3">
                      <Input value={s.stage_name} onChange={(e) => updateStage(s.id, { stage_name: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <input type="color" value={s.color ?? "#004EEB"} onChange={(e) => updateStage(s.id, { color: e.target.value })} />
                        <span className="text-xs text-text2">{s.color}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <input
                        type="checkbox"
                        checked={!!s.is_final}
                        onChange={(e) => updateStage(s.id, { is_final: e.target.checked, final_type: e.target.checked ? (s.final_type ?? "won") : "none" })}
                      />
                    </td>
                    <td className="px-3">
                      <select
                        className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm"
                        disabled={!s.is_final}
                        value={s.is_final ? s.final_type ?? "won" : "none"}
                        onChange={(e) => updateStage(s.id, { final_type: e.target.value })}
                      >
                        <option value="won">Успех (Won)</option>
                        <option value="lost">Провал (Lost)</option>
                      </select>
                    </td>
                    <td className="px-3 w-[180px]">
                      <Input
                        value={s.default_prob === undefined || s.default_prob === null ? "" : String(s.default_prob)}
                        onChange={(e) =>
                          updateStage(s.id, { default_prob: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        placeholder="например 25"
                      />
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => removeStage(s.id)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stages.length ? <div className="text-sm text-text2 py-6">Этапов пока нет.</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
