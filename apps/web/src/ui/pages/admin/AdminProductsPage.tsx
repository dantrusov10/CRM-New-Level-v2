import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { pb } from "../../../lib/pb";
import { notifyPbError } from "../../../lib/pbError";
import type { Product, ProductMaterial } from "../../../lib/types";
import { useProducts, useProductMaterials } from "../../data/hooks";

function safeJsonParse(raw: string): unknown {
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function AdminProductsPage() {
  const qc = useQueryClient();
  const productsQ = useProducts();
  const [selectedId, setSelectedId] = React.useState<string>("");
  const materialsQ = useProductMaterials(selectedId || undefined);

  const [name, setName] = React.useState("");
  const [segment, setSegment] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [technicalSpec, setTechnicalSpec] = React.useState("");
  const [battleCardJson, setBattleCardJson] = React.useState("");
  const [segmentsJson, setSegmentsJson] = React.useState("");

  const [matTitle, setMatTitle] = React.useState("");
  const [matUrl, setMatUrl] = React.useState("");
  const [matType, setMatType] = React.useState<string>("doc");

  const selected = (productsQ.data ?? []).find((p) => p.id === selectedId) ?? null;

  React.useEffect(() => {
    if (!selected) {
      setName("");
      setSegment("");
      setDescription("");
      setTechnicalSpec("");
      setBattleCardJson("");
      setSegmentsJson("");
      return;
    }
    setName(selected.name ?? "");
    setSegment(selected.segment ?? "");
    setDescription(selected.description ?? "");
    setTechnicalSpec(selected.technical_spec ?? "");
    setBattleCardJson(
      selected.battle_card != null ? JSON.stringify(selected.battle_card, null, 2) : "",
    );
    setSegmentsJson(
      selected.target_customer_segments != null
        ? JSON.stringify(selected.target_customer_segments, null, 2)
        : "",
    );
  }, [selected?.id]);

  async function refreshProducts() {
    await qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function createProduct() {
    const n = name.trim() || "Новый продукт";
    try {
      const rec = await pb.collection("products").create({
        name: n,
        segment: segment.trim() || "",
        description: description.trim() || "",
        technical_spec: technicalSpec.trim() || "",
        battle_card: safeJsonParse(battleCardJson) ?? undefined,
        target_customer_segments: safeJsonParse(segmentsJson) ?? undefined,
      });
      setSelectedId(rec.id);
      await refreshProducts();
    } catch (e) {
      notifyPbError(e, "Не удалось создать продукт");
    }
  }

  async function saveProduct() {
    if (!selectedId) return;
    try {
      const bc = safeJsonParse(battleCardJson);
      const ts = safeJsonParse(segmentsJson);
      await pb.collection("products").update(selectedId, {
        name: name.trim(),
        segment: segment.trim() || "",
        description: description.trim() || "",
        technical_spec: technicalSpec.trim() || "",
        battle_card: bc !== null ? bc : undefined,
        target_customer_segments: ts !== null ? ts : undefined,
      });
      await refreshProducts();
    } catch (e) {
      notifyPbError(e, "Не удалось сохранить продукт");
    }
  }

  async function deleteProduct() {
    if (!selectedId || !confirm("Удалить продукт и связанные материалы?")) return;
    try {
      await pb.collection("products").delete(selectedId);
      setSelectedId("");
      await refreshProducts();
    } catch (e) {
      notifyPbError(e, "Не удалось удалить продукт");
    }
  }

  async function addMaterial() {
    if (!selectedId) return;
    try {
      await pb.collection("product_materials").create({
        product_id: selectedId,
        title: matTitle.trim() || "",
        url: matUrl.trim() || "",
        material_type: matType || "doc",
      });
      setMatTitle("");
      setMatUrl("");
      await qc.invalidateQueries({ queryKey: ["product_materials", selectedId] });
    } catch (e) {
      notifyPbError(e, "Не удалось добавить материал");
    }
  }

  async function deleteMaterial(m: ProductMaterial) {
    if (!confirm("Удалить материал?")) return;
    try {
      await pb.collection("product_materials").delete(m.id);
      await qc.invalidateQueries({ queryKey: ["product_materials", selectedId] });
    } catch (e) {
      notifyPbError(e, "Не удалось удалить материал");
    }
  }

  const list = productsQ.data ?? [];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Продукты (для ИИ и КП)</div>
          <div className="text-xs text-text2 mt-1">
            Описание, ТЗ, battle card и материалы подтягиваются в контекст анализа сделки при выборе продуктов в
            карточке.
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 border border-border rounded-card p-3 max-h-[480px] overflow-auto">
              <div className="flex gap-2 mb-3">
                <Button type="button" onClick={createProduct}>
                  + Продукт
                </Button>
                <Button type="button" variant="secondary" onClick={() => productsQ.refetch()}>
                  Обновить список
                </Button>
              </div>
              {productsQ.isLoading ? (
                <div className="text-sm text-text2">Загрузка...</div>
              ) : (
                <ul className="space-y-1">
                  {list.map((p: Product) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-md ${
                          p.id === selectedId ? "bg-primary/15 font-medium" : "hover:bg-border/40"
                        }`}
                        onClick={() => setSelectedId(p.id)}
                      >
                        {p.name || p.id}
                      </button>
                    </li>
                  ))}
                  {!list.length ? <div className="text-sm text-text2">Продуктов пока нет.</div> : null}
                </ul>
              )}
            </div>
            <div className="col-span-8 grid gap-3">
              {!selectedId ? (
                <div className="text-sm text-text2">Выберите продукт слева или создайте новый.</div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Название</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Сегмент / линейка</label>
                    <Input value={segment} onChange={(e) => setSegment(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Описание</label>
                    <textarea
                      className="min-h-[80px] w-full rounded-card border border-border bg-white px-3 py-2 text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Техническое задание / спецификация (текст)</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-card border border-border bg-white px-3 py-2 text-sm font-mono text-xs"
                      value={technicalSpec}
                      onChange={(e) => setTechnicalSpec(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Целевые сегменты (JSON, опционально)</label>
                    <textarea
                      className="min-h-[72px] w-full rounded-card border border-border bg-white px-3 py-2 text-sm font-mono text-xs"
                      value={segmentsJson}
                      onChange={(e) => setSegmentsJson(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-text2">Battle card (JSON, опционально)</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-card border border-border bg-white px-3 py-2 text-sm font-mono text-xs"
                      value={battleCardJson}
                      onChange={(e) => setBattleCardJson(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" onClick={saveProduct}>
                      Сохранить
                    </Button>
                    <Button type="button" variant="secondary" onClick={deleteProduct}>
                      Удалить продукт
                    </Button>
                  </div>

                  <div className="border-t border-border pt-4 mt-2">
                    <div className="text-sm font-semibold mb-2">Материалы</div>
                    <div className="flex flex-wrap gap-2 items-end mb-3">
                      <div className="flex-1 min-w-[140px]">
                        <label className="text-xs text-text2">Заголовок</label>
                        <Input value={matTitle} onChange={(e) => setMatTitle(e.target.value)} />
                      </div>
                      <div className="flex-[2] min-w-[180px]">
                        <label className="text-xs text-text2">URL</label>
                        <Input value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://..." />
                      </div>
                      <div>
                        <label className="text-xs text-text2">Тип</label>
                        <select
                          className="h-10 rounded-card border border-border bg-white px-2 text-sm"
                          value={matType}
                          onChange={(e) => setMatType(e.target.value)}
                        >
                          <option value="presentation">presentation</option>
                          <option value="doc">doc</option>
                          <option value="pdf">pdf</option>
                          <option value="link">link</option>
                        </select>
                      </div>
                      <Button type="button" onClick={addMaterial}>
                        Добавить
                      </Button>
                    </div>
                    {materialsQ.isLoading ? (
                      <div className="text-sm text-text2">Загрузка материалов...</div>
                    ) : (
                      <ul className="space-y-2">
                        {(materialsQ.data ?? []).map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 text-sm border border-border rounded-md px-2 py-1"
                          >
                            <span className="truncate">
                              {m.title || "—"}{" "}
                              <span className="text-text2">({m.material_type})</span>
                              {m.url ? (
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-primary underline"
                                >
                                  ссылка
                                </a>
                              ) : null}
                            </span>
                            <Button type="button" variant="secondary" onClick={() => deleteMaterial(m)}>
                              Удалить
                            </Button>
                          </li>
                        ))}
                        {!(materialsQ.data ?? []).length ? (
                          <div className="text-sm text-text2">Материалов нет.</div>
                        ) : null}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
