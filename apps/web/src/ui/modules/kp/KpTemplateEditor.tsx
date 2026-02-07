import React from "react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { KpPreview } from "./KpPreview";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function KpTemplateEditor({
  templateRecord,
  onSave,
  onReload,
  dealIdForPreview = "DEAL_PREVIEW",
}: {
  templateRecord: any | null;
  onSave: (patch: any) => Promise<void>;
  onReload: () => void;
  dealIdForPreview?: string;
}) {
  const initial = React.useMemo(() => {
    const json = templateRecord?.template_json;
    return json && typeof json === "object" ? deepClone(json) : deepClone(DEFAULT_KP_TEMPLATE_V1);
  }, [templateRecord?.id]);

  const [draft, setDraft] = React.useState<any>(initial);
  const [previewMode, setPreviewMode] = React.useState<"manager" | "pdf">("manager");
  const [demoInput, setDemoInput] = React.useState<any>({
    clientName: "ООО «Ромашка»",
    clientInn: "1111111111",
    clientEmail: "it@romashka.ru",
  });
  const [demoItems, setDemoItems] = React.useState<any[]>([
    { id: "i1", name: "Лицензия — базовая", qty: 100, unitPrice: 1000, source: "custom" },
    { id: "i2", name: "Техподдержка — стандарт", qty: 1, unitPrice: 50000, source: "custom" },
  ]);

  React.useEffect(() => {
    setDraft(initial);
  }, [initial]);

  function updateBrand(path: string, value: any) {
    setDraft((p: any) => {
      const n = deepClone(p);
      n.branding = n.branding || {};
      (n.branding as any)[path] = value;
      return n;
    });
  }

  function updateField(sectionId: string, fieldId: string, patch: any) {
    setDraft((p: any) => {
      const n = deepClone(p);
      const sec = (n.ui?.sections || []).find((s: any) => s.id === sectionId);
      if (!sec) return n;
      const idx = (sec.fields || []).findIndex((f: any) => f.id === fieldId);
      if (idx < 0) return n;
      sec.fields[idx] = { ...sec.fields[idx], ...patch };
      return n;
    });
  }

  function updateColumn(key: string, patch: any) {
    setDraft((p: any) => {
      const n = deepClone(p);
      const cols = n.specification?.columns || [];
      const idx = cols.findIndex((c: any) => c.key === key);
      if (idx >= 0) cols[idx] = { ...cols[idx], ...patch };
      n.specification = { ...(n.specification || {}), columns: cols };
      return n;
    });
  }

  async function save() {
    await onSave({ template_json: draft, name: draft?.name || templateRecord?.name || "КП" });
    onReload();
  }

  const sections = draft?.ui?.sections || [];

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-6 grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Конструктор КП (каркас)</div>
                <div className="text-xs text-text2 mt-1">Редактирование наименований полей + обязательность + шаблон спецификации</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setDraft(deepClone(DEFAULT_KP_TEMPLATE_V1)); }}>
                  Сбросить на дефолт
                </Button>
                <Button onClick={save}>Сохранить</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-text2 mb-1">Название шаблона</div>
                  <Input value={draft?.name || ""} onChange={(e) => setDraft((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-text2 mb-1">НДС % (централизованно)</div>
                  <Input
                    value={String(draft?.defaults?.vatPercent ?? 20)}
                    onChange={(e) => setDraft((p: any) => ({ ...p, defaults: { ...(p.defaults || {}), vatPercent: Number(e.target.value || 20) } }))}
                  />
                </div>
              </div>

              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="text-sm font-semibold mb-2">Брендинг</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-text2 mb-1">Название компании</div>
                    <Input value={draft?.branding?.companyName || ""} onChange={(e) => updateBrand("companyName", e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-text2 mb-1">Акцент (HEX)</div>
                    <Input value={draft?.branding?.primaryColor || ""} onChange={(e) => updateBrand("primaryColor", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Дисклеймер</div>
                    <textarea
                      className="w-full min-h-[90px] rounded-card border border-[#9CA3AF] bg-white p-3 text-sm"
                      value={draft?.branding?.disclaimer || ""}
                      onChange={(e) => updateBrand("disclaimer", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Поля формы (наименования + обязательность)</div>
                  <Badge>влияет на UI менеджера</Badge>
                </div>
                <div className="mt-3 grid gap-4">
                  {sections.map((sec: any) => (
                    <div key={sec.id} className="rounded-card border border-border bg-white p-3">
                      <div className="text-sm font-semibold">{sec.title}</div>
                      <div className="mt-2 grid gap-2">
                        {(sec.fields || []).map((f: any) => (
                          <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4 text-xs text-text2">ID: {f.id}</div>
                            <div className="col-span-6">
                              <Input value={f.label || ""} onChange={(e) => updateField(sec.id, f.id, { label: e.target.value })} />
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <label className="text-xs text-text2 flex items-center gap-2">
                                <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(sec.id, f.id, { required: e.target.checked })} />
                                обяз.
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Колонки спецификации (наименования)</div>
                  <Badge>влияет на PDF</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {(draft?.specification?.columns || []).map((c: any) => (
                    <div key={c.key} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3 text-xs text-text2">{c.key}</div>
                      <div className="col-span-7">
                        <Input value={c.label || ""} onChange={(e) => updateColumn(c.key, { label: e.target.value })} />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <label className="text-xs text-text2 flex items-center gap-2">
                          <input type="checkbox" checked={c.optional !== true} onChange={(e) => updateColumn(c.key, { optional: !e.target.checked })} />
                          видимо
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-6 grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Предпросмотр спецификации</div>
                <div className="text-xs text-text2 mt-1">Как это будет выглядеть у менеджера и в PDF</div>
              </div>
              <div className="flex gap-2">
                <Button variant={previewMode === "manager" ? "primary" : "secondary"} onClick={() => setPreviewMode("manager")}>UI</Button>
                <Button variant={previewMode === "pdf" ? "primary" : "secondary"} onClick={() => setPreviewMode("pdf")}>PDF</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-card border border-border bg-rowHover p-3">
                <div className="text-sm font-semibold mb-2">Демо-данные для предпросмотра</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={demoInput.clientName || ""} onChange={(e) => setDemoInput((p: any) => ({ ...p, clientName: e.target.value }))} placeholder="Компания" />
                  <Input value={demoInput.clientEmail || ""} onChange={(e) => setDemoInput((p: any) => ({ ...p, clientEmail: e.target.value }))} placeholder="Email" />
                  <Input value={demoInput.clientInn || ""} onChange={(e) => setDemoInput((p: any) => ({ ...p, clientInn: e.target.value }))} placeholder="ИНН" />
                  <Input value={String(demoInput.discountManualPercent || "")} onChange={(e) => setDemoInput((p: any) => ({ ...p, discountManualPercent: e.target.value }))} placeholder="Скидка %" />
                </div>
              </div>

              <div className="rounded-card border border-border bg-white p-3">
                <KpPreview template={draft} input={demoInput} items={demoItems} dealId={dealIdForPreview} mode={previewMode} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
