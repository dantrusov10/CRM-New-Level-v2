import React from "react";
import { ImagePlus, Save } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { KpPagedDocumentPreview } from "./KpPagedDocumentPreview";
import { KpTemplateImportExport } from "./KpTemplateImportExport";
import { KpDocumentSectionsEditor } from "./KpDocumentSectionsEditor";
import { KpDesignSettings } from "./KpDesignSettings";
import "./kpDocumentFonts";
import { DEFAULT_KP_TEMPLATE_V1, DEFAULT_TKP_TEMPLATE_V1 } from "./defaultTemplate";
import { documentTypeLabel } from "./kpDocumentMeta";
import { applyPdfBlockPresetForDoc } from "./kpPdfBlocks";
import type { KpDocumentType } from "./types";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import { pb } from "../../../lib/pb";
import type { KpInput, KpTemplateConfig, KpTemplateRecord, SpecItem } from "./types";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const BRAND_PRESETS: { id: string; label: string; color: string }[] = [
  { id: "blue", label: "Синий", color: "#004EEB" },
  { id: "slate", label: "Серый", color: "#334155" },
  { id: "teal", label: "Бирюза", color: "#0D9488" },
  { id: "violet", label: "Фиолетовый", color: "#6D28D9" },
];

const DEMO_INPUT_KP: KpInput = {
  clientName: "ООО «Ромашка»",
  clientInn: "7701234567",
  clientEmail: "it@romashka.ru",
  paymentTerms: "split50_50",
  deliveryDate: "в течение 10 рабочих дней",
  comment: "Демо-данные для предпросмотра.",
};

const DEMO_INPUT_TKP: KpInput = {
  ...DEMO_INPUT_KP,
  technicalIntro:
    "Поставка лицензий и техподдержки. Внедрение: аудит → пилот → промышленная эксплуатация. SLA 8×5, время реакции до 4 ч.",
};

const DEMO_ITEMS: SpecItem[] = [
  { id: "i1", name: "Лицензия — базовая", qty: 100, unitPrice: 1000, vatPercent: 20, source: "custom" },
  { id: "i2", name: "Техподдержка — стандарт", qty: 1, unitPrice: 50000, vatPercent: 20, source: "custom" },
];

export function KpTemplateEditor({
  templateRecord,
  onSave,
  onReload,
  dealIdForPreview = "DEMO-001",
  variant = "full",
  onSaved,
}: {
  templateRecord: KpTemplateRecord | null;
  onSave: (patch: { template_json: KpTemplateConfig; name: string }) => Promise<void>;
  onReload: () => void;
  dealIdForPreview?: string;
  variant?: "full" | "wizard";
  onSaved?: () => void;
}) {
  const isWizard = variant === "wizard";
  const [saving, setSaving] = React.useState(false);

  const initial = React.useMemo(() => {
    const json = templateRecord?.template_json;
    const base =
      json && typeof json === "object" ? (deepClone(json) as KpTemplateConfig) : deepClone(DEFAULT_KP_TEMPLATE_V1);
    base.pdfBlocks = ensurePdfBlocks(base);
    return base;
  }, [templateRecord?.id]);

  const [draft, setDraft] = React.useState<KpTemplateConfig>(initial);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState("");

  React.useEffect(() => {
    setDraft(initial);
  }, [initial]);

  React.useEffect(() => {
    const rec = templateRecord;
    if (rec?.id && rec?.logo) {
      try {
        const url = pb.files.getUrl(rec, rec.logo);
        setLogoPreviewUrl(url);
        setDraft((p) => {
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

  function updateBrand(path: string, value: string) {
    setDraft((p) => {
      const n = deepClone(p);
      n.branding = n.branding || {};
      (n.branding as Record<string, unknown>)[path] = value;
      return n;
    });
  }

  function updateSignature(path: string, value: string) {
    setDraft((p) => {
      const n = deepClone(p);
      n.branding = n.branding || {};
      n.branding.signature = { ...(n.branding.signature || {}), [path]: value };
      return n;
    });
  }

  async function uploadLogoIfNeeded() {
    if (!logoFile || !templateRecord?.id) return;
    const fd = new FormData();
    fd.append("logo", logoFile);
    const upd = await pb.collection("settings_kp_templates").update(templateRecord.id, fd);
    if (upd?.logo) {
      const url = pb.files.getUrl(upd, upd.logo);
      setLogoPreviewUrl(url);
      setDraft((p) => {
        const n = deepClone(p);
        n.branding = n.branding || {};
        n.branding.logoUrl = url;
        return n;
      });
    }
    setLogoFile(null);
  }

  async function save() {
    setSaving(true);
    try {
      await uploadLogoIfNeeded();
      await onSave({ template_json: draft, name: draft?.name || templateRecord?.name || "КП" });
      onReload();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const accent = draft?.branding?.primaryColor || "#004EEB";
  const docType: KpDocumentType = draft?.documentType === "tkp" ? "tkp" : "kp";
  const demoInput = docType === "tkp" ? DEMO_INPUT_TKP : DEMO_INPUT_KP;

  function setDocumentType(type: KpDocumentType) {
    setDraft((p) => {
      const n = deepClone(p);
      n.documentType = type;
      if (type === "tkp" && !n.branding?.technicalIntroDefault) {
        n.branding = n.branding || {};
        n.branding.technicalIntroDefault = DEFAULT_TKP_TEMPLATE_V1.branding?.technicalIntroDefault || "";
      }
      n.pdfBlocks = applyPdfBlockPresetForDoc("standard", type);
      return n;
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[640px]">
      <div className="xl:col-span-5 grid gap-4 content-start">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{isWizard ? "Оформление документа" : "Шаблон КП"}</div>
                <div className="text-xs text-text2 mt-1">Логотип, фирменный стиль и разделы PDF</div>
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                <Save size={16} className="mr-1" />
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="text-xs text-text2 mb-1">Название шаблона (для админки)</div>
              <Input value={draft?.name || ""} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <div className="text-xs text-text2 mb-2">Тип документа</div>
              <div className="flex flex-wrap gap-2">
                {(["kp", "tkp"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDocumentType(t)}
                    className={`rounded-card border px-4 py-2 text-sm font-semibold ${
                      docType === t ? "border-primary bg-primary/15" : "border-border bg-white"
                    }`}
                  >
                    {documentTypeLabel(t)}
                    <span className="block text-[10px] font-normal text-text2 mt-0.5">
                      {t === "kp" ? "Коммерческое предложение" : "Технико-коммерческое"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-card border border-border bg-rowHover p-4 grid gap-3">
              <div className="text-sm font-semibold">Фирменный стиль</div>

              <div>
                <div className="text-xs text-text2 mb-2">Логотип</div>
                <label className="flex items-center gap-3 cursor-pointer rounded-card border border-dashed border-border bg-white p-3 hover:border-primary transition-colors">
                  <ImagePlus size={20} className="text-text2 shrink-0" />
                  <span className="text-xs text-text2">PNG или JPG, до 2 МБ</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setLogoFile(f);
                      if (f) setLogoPreviewUrl(URL.createObjectURL(f));
                    }}
                  />
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="" className="ml-auto h-10 max-w-[120px] object-contain" />
                  ) : null}
                </label>
              </div>

              <div>
                <div className="text-xs text-text2 mb-1">Название вашей компании в шапке</div>
                <Input
                  value={draft?.branding?.companyName || ""}
                  onChange={(e) => updateBrand("companyName", e.target.value)}
                  placeholder="ООО «Решение»"
                />
              </div>

              <div>
                <div className="text-xs text-text2 mb-2">Цвет акцента</div>
                <div className="flex flex-wrap gap-2">
                  {BRAND_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateBrand("primaryColor", p.color)}
                      className={`flex items-center gap-2 rounded-card border px-3 py-1.5 text-xs ${
                        accent === p.color ? "border-primary bg-primary/10" : "border-border bg-white"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: p.color }} />
                      {p.label}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 rounded-card border border-border bg-white px-2 py-1 text-xs cursor-pointer">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => updateBrand("primaryColor", e.target.value)}
                      className="h-6 w-8 cursor-pointer border-0 p-0"
                    />
                    Свой
                  </label>
                </div>
              </div>

              <div>
                <div className="text-xs text-text2 mb-1">Контакты в шапке (телефон, email)</div>
                <Input
                  value={draft?.branding?.footerText || ""}
                  onChange={(e) => updateBrand("footerText", e.target.value)}
                  placeholder="sales@company.ru · +7 …"
                />
              </div>

              <div>
                <div className="text-xs text-text2 mb-1">Подпись менеджера в PDF</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={draft?.branding?.signature?.name || ""}
                    onChange={(e) => updateSignature("name", e.target.value)}
                    placeholder="ФИО"
                  />
                  <Input
                    value={draft?.branding?.signature?.title || ""}
                    onChange={(e) => updateSignature("title", e.target.value)}
                    placeholder="Должность"
                  />
                  <Input
                    value={draft?.branding?.signature?.phone || ""}
                    onChange={(e) => updateSignature("phone", e.target.value)}
                    placeholder="Телефон"
                  />
                  <Input
                    value={draft?.branding?.signature?.email || ""}
                    onChange={(e) => updateSignature("email", e.target.value)}
                    placeholder="Email"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-text2 mb-1">Юридическая оговорка внизу страницы</div>
                <textarea
                  className="w-full min-h-[72px] rounded-card border border-[#9CA3AF] bg-white p-3 text-sm"
                  value={draft?.branding?.disclaimer || ""}
                  onChange={(e) => updateBrand("disclaimer", e.target.value)}
                  placeholder="Не является офертой…"
                />
              </div>

              <div>
                <div className="text-xs text-text2 mb-1">НДС в расчётах, %</div>
                <Input
                  type="number"
                  className="max-w-[120px]"
                  value={String(draft?.defaults?.vatPercent ?? 20)}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      defaults: { ...(p.defaults || {}), vatPercent: Number(e.target.value || 20) },
                    }))
                  }
                />
              </div>

              {docType === "tkp" ? (
                <div>
                  <div className="text-xs text-text2 mb-1">Текст технического блока по умолчанию</div>
                  <textarea
                    className="w-full min-h-[88px] rounded-card border border-[#9CA3AF] bg-white p-3 text-sm"
                    value={draft?.branding?.technicalIntroDefault || ""}
                    onChange={(e) => updateBrand("technicalIntroDefault", e.target.value)}
                    placeholder="Описание решения, этапы, SLA…"
                  />
                  <p className="text-[10px] text-text2 mt-1">Менеджер может переопределить в сделке на шаге «Условия».</p>
                </div>
              ) : null}
            </div>

            <KpTemplateImportExport
              draft={draft}
              onImport={(json) => {
                const next = deepClone(json);
                next.pdfBlocks = ensurePdfBlocks(next);
                setDraft(next);
              }}
            />

            <KpDesignSettings draft={draft} onChange={setDraft} />

            <KpDocumentSectionsEditor
              blocks={ensurePdfBlocks(draft)}
              onChange={(pdfBlocks) => setDraft((p) => ({ ...p, pdfBlocks }))}
              documentType={docType}
            />
          </CardContent>
        </Card>
      </div>

      <div className="xl:col-span-7 xl:sticky xl:top-4 self-start min-h-[560px]">
        <KpPagedDocumentPreview
          template={draft}
          input={demoInput}
          items={DEMO_ITEMS}
          dealId={dealIdForPreview}
        />
      </div>
    </div>
  );
}
