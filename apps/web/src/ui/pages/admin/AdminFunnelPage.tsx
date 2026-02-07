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
  const [defaultProb, setDefaultProb] = React.useState<number>(10);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      // PocketBase schema: stage_name + position
      const s = await pb.collection("settings_funnel_stages").getFullList({ sort: "position" });
      setStages(s as any);
    } catch (err: any) {
      console.error("PB load stages error:", err);
      setStages([]);
      setError(err?.data?.message || err?.message || "Не удалось загрузить этапы из PocketBase");
    }
  }
  React.useEffect(() => {
    load();
  }, []);

  async function addStage() {
    const position = stages.length ? Math.max(...stages.map((x) => Number(x.position ?? 0))) + 1 : 1;
    try {
      setError(null);
      await pb.collection("settings_funnel_stages").create({
        stage_name: name.trim(),
        color,
        position,
        active: true,
        is_final: false,
        final_type: "none",
        // В PB часто field number не принимает null/undefined, поэтому шлём число всегда
        default_prob: Number.isFinite(defaultProb) ? defaultProb : 10,
      });
      setName("");
      await load();
    } catch (err: any) {
      console.error("PB create stage error:", err);
      setError(err?.data?.message || err?.message || "Не удалось создать этап");
      // Для дебага в UI показываем всё, что PocketBase вернул
      if (err?.data) {
        console.error("PB error data:", err.data);
      }
    }
    setName("");
    // load() вызван в try выше
  }

  async function updateStage(id: string, data: any) {
    try {
      setError(null);
      await pb.collection("settings_funnel_stages").update(id, data);
      await load();
    } catch (err: any) {
      console.error("PB update stage error:", err);
      setError(err?.data?.message || err?.message || "Не удалось обновить этап");
    }
  }

  async function removeStage(id: string) {
    try {
      setError(null);
      await pb.collection("settings_funnel_stages").delete(id);
      await load();
    } catch (err: any) {
      console.error("PB delete stage error:", err);
      setError(err?.data?.message || err?.message || "Не удалось удалить этап");
    }
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
      await pb.collection("settings_funnel_stages").create({
        stage_name: s.stage_name.trim(),
        position: s.position ?? 0,
        color: s.color ?? "#004EEB",
        active: s.active ?? true,
        is_final: s.is_final ?? false,
        final_type: s.is_final ? (s.final_type ?? "won") : "none",
        // не отправляем null в number
        default_prob: s.default_prob ?? 10,
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
          {error ? (
            <div className="rounded-card border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-[1fr_140px_180px_120px] gap-2 items-end">
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
            <div>
              <div className="text-xs text-text2 mb-1">Вероятность (по умолч.)</div>
              <Input value={String(defaultProb)} onChange={(e) => setDefaultProb(Number(e.target.value || 0))} placeholder="например 10" />
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
                          // В PB number поле часто не принимает null. Если поле очищают — ставим 0.
                          updateStage(s.id, { default_prob: e.target.value === "" ? 0 : Number(e.target.value) })
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
