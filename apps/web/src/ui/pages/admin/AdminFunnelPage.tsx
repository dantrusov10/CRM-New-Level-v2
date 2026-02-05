import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";

export function AdminFunnelPage() {
  const [stages, setStages] = React.useState<any[]>([]);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#004EEB");

  async function load() {
    const s = await pb.collection("settings_funnel_stages").getFullList({ sort: "order" });
    setStages(s as any);
  }
  React.useEffect(() => { load(); }, []);

  async function addStage() {
    const order = stages.length ? Math.max(...stages.map((x) => x.order ?? 0)) + 1 : 1;
    await pb.collection("settings_funnel_stages").create({ name, color, order, is_final: false });
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
    const blob = new Blob([JSON.stringify(stages, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "funnel_stages.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    const txt = await file.text();
    const arr = JSON.parse(txt);
    // naive: clear and reinsert
    for (const s of stages) await pb.collection("settings_funnel_stages").delete(s.id).catch(() => {});
    for (const s of arr) {
      await pb.collection("settings_funnel_stages").create({
        name: s.name,
        color: s.color,
        order: s.order,
        is_final: s.is_final ?? false,
        final_type: s.final_type ?? null,
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
            <Button variant="secondary" onClick={exportJson}>Экспорт</Button>
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
              <input type="color" className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-2" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <Button onClick={addStage} disabled={!name.trim()}>Добавить</Button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="h-10 bg-[#EEF1F6] text-[#374151] font-semibold">
                  <th className="text-left px-3">Порядок</th>
                  <th className="text-left px-3">Название</th>
                  <th className="text-left px-3">Цвет</th>
                  <th className="text-left px-3">Финальный</th>
                  <th className="text-left px-3">Тип</th>
                  <th className="text-right px-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.id} className="h-11 border-b border-border">
                    <td className="px-3 w-[110px]">
                      <Input
                        value={String(s.order ?? 0)}
                        onChange={(e) => updateStage(s.id, { order: Number(e.target.value || 0) })}
                      />
                    </td>
                    <td className="px-3">
                      <Input value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} />
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <input type="color" value={s.color} onChange={(e) => updateStage(s.id, { color: e.target.value })} />
                        <span className="text-xs text-text2">{s.color}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <input type="checkbox" checked={!!s.is_final} onChange={(e) => updateStage(s.id, { is_final: e.target.checked })} />
                    </td>
                    <td className="px-3">
                      <select className="h-9 rounded-card border border-[#9CA3AF] bg-white px-2 text-sm" value={s.final_type ?? ""} onChange={(e) => updateStage(s.id, { final_type: e.target.value || null })}>
                        <option value="">—</option>
                        <option value="win">win</option>
                        <option value="loss">loss</option>
                      </select>
                    </td>
                    <td className="px-3 text-right">
                      <Button variant="danger" small onClick={() => removeStage(s.id)}>Удалить</Button>
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
