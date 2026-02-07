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

export function AdminFunnelPage() {
  const [stages, setStages] = React.useState<FunnelStage[]>([]);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#004EEB");
  const [settingsId, setSettingsId] = React.useState<string | null>(null);

  // Некоторые инсталляции PB делают funnel stages «под-настройкой» и требуют settings_id (relation).
  // Чтобы не править вручную схему на сервере, пытаемся найти любой singleton settings record и подставлять его id.
  async function resolveSettingsId(): Promise<string | null> {
    if (settingsId) return settingsId;

    const candidates = [
      "settings",
      "app_settings",
      "settings_main",
      "settings_general",
      "settings_core",
      "settings_funnel",
      "settings_sales_funnel",
    ];

    for (const col of candidates) {
      try {
        const list = await pb.collection(col).getList(1, 1, { sort: "-created" });
        const id = (list?.items?.[0] as any)?.id;
        if (id) {
          setSettingsId(id);
          return id;
        }
      } catch (_) {
        // ignore
      }
    }
    return null;
  }

  async function load() {
    // PocketBase schema: stage_name + position
    const s = await pb.collection("settings_funnel_stages").getFullList({ sort: "position" });
    setStages(s as any);
  }
  React.useEffect(() => {
    load();
    // фоновая попытка найти settings_id
    resolveSettingsId();
  }, []);

  async function addStage() {
    const position = stages.length ? Math.max(...stages.map((x) => Number(x.position ?? 0))) + 1 : 1;

    const sid = await resolveSettingsId();

    // ВАЖНО: PocketBase жёстко валидирует select/required поля.
    // Чтобы не ловить 400 из-за несовпадения enum (final_type) или отсутствующих полей,
    // создаём запись минимальным набором бизнес‑полей.
    // Доп. поля (active/is_final/final_type/default_prob) будут доступны, если они реально есть в схеме PB.
    await pb.collection("settings_funnel_stages").create({
      stage_name: name.trim(),
      color,
      position,
      ...(sid ? { settings_id: sid } : {}),
    });
    setName("");
    load();
  }

  async function updateStage(id: string, data: any) {
    // как и при создании — отправляем только «безопасные» поля,
    // и не шлём final_type="none" (часто enum в PB на проде другой: win/loss или пусто)
    const safe: any = {};
    if (data.stage_name !== undefined) safe.stage_name = String(data.stage_name);
    if (data.position !== undefined) safe.position = Number(data.position);
    if (data.color !== undefined) safe.color = String(data.color);
    if (data.active !== undefined) safe.active = !!data.active;
    if (data.is_final !== undefined) safe.is_final = !!data.is_final;
    if (data.default_prob !== undefined) safe.default_prob = data.default_prob === null ? null : Number(data.default_prob);

    if (data.final_type !== undefined) {
      const ft = String(data.final_type);
      if (ft && ft !== "none") safe.final_type = ft; // не отправляем none
      else safe.final_type = ""; // если enum другой, пустая строка чаще проходит как "не задано"
    }

    await pb.collection("settings_funnel_stages").update(id, safe);
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

    const sid = await resolveSettingsId();
    for (const s of normalized) {
      if (!s.stage_name?.trim()) continue;

      // Импорт тоже делаем «безопасным»: минимальный payload.
      // Если в вашей схеме PB присутствуют дополнительные поля — они будут выставляться через update ниже.
      const created: any = await pb.collection("settings_funnel_stages").create({
        stage_name: s.stage_name.trim(),
        position: s.position ?? 0,
        color: s.color ?? "#004EEB",
        ...(sid ? { settings_id: sid } : {}),
      });

      const extra: any = {};
      if (s.active !== undefined) extra.active = s.active;
      if (s.is_final !== undefined) extra.is_final = s.is_final;
      if (s.default_prob !== undefined) extra.default_prob = s.default_prob;

      // final_type отправляем ТОЛЬКО если это финальный этап и значение явно задано.
      if (s.is_final && s.final_type && s.final_type !== "none") {
        extra.final_type = s.final_type;
      }

      if (Object.keys(extra).length) {
        await pb.collection("settings_funnel_stages").update(created.id, extra).catch(() => {});
      }
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
