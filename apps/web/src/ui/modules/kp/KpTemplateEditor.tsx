import React from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { KpPreview } from "./KpPreview";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";
import { pb } from "../../../lib/pb";

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
  const [pdfUrl, setPdfUrl] = React.useState<string>("");
  const pdfRenderRef = React.useRef<HTMLDivElement | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string>("");
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

  React.useEffect(() => {
    // show current logo from PocketBase record
    const rec = templateRecord;
    if (rec?.id && rec?.logo) {
      try {
        const url = pb.files.getUrl(rec, rec.logo);
        setLogoPreviewUrl(url);
        setDraft((p: any) => {
          const n = deepClone(p);
          n.branding = n.branding || {};
          n.branding.logoUrl = url;
          return n;
        });
      } catch {
        // ignore
      }
    }
  }, [templateRecord?.id, templateRecord?.logo]);

  function updateBrand(path: string, value: any) {
    setDraft((p: any) => {
      const n = deepClone(p);
      n.branding = n.branding || {};
      (n.branding as any)[path] = value;
      return n;
    });
  }

  function updatePdfDesign(path: string, value: any) {
    setDraft((p: any) => {
      const n = deepClone(p);
      n.pdfDesign = n.pdfDesign || {};
      (n.pdfDesign as any)[path] = value;
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

  function addField(sectionId: string) {
    setDraft((p: any) => {
      const n = deepClone(p);
      const sec = (n.ui?.sections || []).find((s: any) => s.id === sectionId);
      if (!sec) return n;
      const nextIdx = (sec.fields || []).length + 1;
      const id = `custom_${sectionId}_${nextIdx}_${Math.random().toString(36).slice(2, 6)}`;
      sec.fields = sec.fields || [];
      sec.fields.push({
        id,
        label: "Новое поле",
        type: "text",
        required: false,
        placeholder: "",
        options: [],
      });
      return n;
    });
  }

  function deleteField(sectionId: string, fieldId: string) {
    setDraft((p: any) => {
      const n = deepClone(p);
      const sec = (n.ui?.sections || []).find((s: any) => s.id === sectionId);
      if (!sec) return n;
      sec.fields = (sec.fields || []).filter((f: any) => f.id !== fieldId);
      return n;
    });
  }

  async function uploadLogoIfNeeded() {
    if (!logoFile || !templateRecord?.id) return;
    const fd = new FormData();
    fd.append("logo", logoFile);
    const upd = await pb.collection("settings_kp_templates").update(templateRecord.id, fd as any);
    // refresh preview URL
    if (upd?.logo) {
      const url = pb.files.getUrl(upd, upd.logo);
      setLogoPreviewUrl(url);
      setDraft((p: any) => {
        const n = deepClone(p);
        n.branding = n.branding || {};
        n.branding.logoUrl = url;
        return n;
      });
    }
    setLogoFile(null);
  }

  async function buildPdfPreview() {
    // Render hidden A4-like preview to PDF and show in iframe
    if (!pdfRenderRef.current) return;
    const el = pdfRenderRef.current;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = (pdf as any).getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    let heightLeft = imgHeight - pageHeight;
    while (heightLeft > 0) {
      position = position - pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  React.useEffect(() => {
    if (previewMode !== "pdf") return;
    // debounce rebuild
    const t = window.setTimeout(() => {
      buildPdfPreview();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, draft, demoInput, demoItems]);

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
    await uploadLogoIfNeeded();
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
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Логотип (для PDF)</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setLogoFile(f);
                          if (f) setLogoPreviewUrl(URL.createObjectURL(f));
                        }}
                      />
                      {logoPreviewUrl ? <img src={logoPreviewUrl} alt="logo" className="h-10 rounded" /> : <span className="text-xs text-text2">—</span>}
                    </div>
                    <div className="text-xs text-text2 mt-1">Логотип сохраняется в PocketBase в поле <code>settings_kp_templates.logo</code>.</div>
                  </div>
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
                <div className="text-sm font-semibold mb-2">Дизайн PDF</div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Фон страницы (HEX)</div>
                    <Input value={draft?.pdfDesign?.paperBg || "#ffffff"} onChange={(e) => updatePdfDesign("paperBg", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Основной текст (HEX)</div>
                    <Input value={draft?.pdfDesign?.textColor || "#111827"} onChange={(e) => updatePdfDesign("textColor", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Шапка таблицы (фон)</div>
                    <Input value={draft?.pdfDesign?.tableHeaderBg || "#EEF1F6"} onChange={(e) => updatePdfDesign("tableHeaderBg", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-text2 mb-1">Шапка таблицы (текст)</div>
                    <Input value={draft?.pdfDesign?.tableHeaderText || "#374151"} onChange={(e) => updatePdfDesign("tableHeaderText", e.target.value)} />
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
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{sec.title}</div>
                        <Button variant="secondary" onClick={() => addField(sec.id)}>+ Поле</Button>
                      </div>
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
                              <Button variant="secondary" onClick={() => deleteField(sec.id, f.id)}>Удалить</Button>
                            </div>
                            <div className="col-span-12 grid grid-cols-12 gap-2">
                              <div className="col-span-4">
                                <div className="text-xs text-text2 mb-1">Тип</div>
                                <select
                                  className="h-10 w-full rounded-card border border-[#9CA3AF] bg-white px-3 text-sm"
                                  value={f.type || "text"}
                                  onChange={(e) => updateField(sec.id, f.id, { type: e.target.value })}
                                >
                                  <option value="text">Текст</option>
                                  <option value="number">Число</option>
                                  <option value="email">Email</option>
                                  <option value="date">Дата</option>
                                  <option value="textarea">Текст (многостр.)</option>
                                  <option value="select">Список</option>
                                </select>
                              </div>
                              <div className="col-span-8">
                                <div className="text-xs text-text2 mb-1">Опции (для списка) — через запятую</div>
                                <Input
                                  value={(f.options || []).map((o: any) => o.label || o.value).join(", ")}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const arr = raw
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .map((s) => ({ label: s, value: s }));
                                    updateField(sec.id, f.id, { options: arr });
                                  }}
                                  placeholder="OptionA, OptionB"
                                />
                              </div>
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
                {previewMode === "manager" ? (
                  <KpPreview template={draft} input={demoInput} items={demoItems} dealId={dealIdForPreview} mode={"manager"} />
                ) : (
                  <div className="grid gap-3">
                    <div className="text-xs text-text2">Предпросмотр PDF (A4)</div>
                    <iframe title="kp-pdf-preview" className="w-full h-[680px] rounded-card border border-border bg-white" src={pdfUrl || undefined} />
                    {/* Hidden renderer for html2canvas */}
                    <div className="absolute -left-[99999px] top-0">
                      <div ref={pdfRenderRef} style={{ width: 794, background: "#fff", padding: 24 }}>
                        <KpPreview template={draft} input={demoInput} items={demoItems} dealId={dealIdForPreview} mode={"pdf"} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
