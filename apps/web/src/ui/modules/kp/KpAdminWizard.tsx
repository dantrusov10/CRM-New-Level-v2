import React from "react";
import { ArrowRight, FileText, ListOrdered, Package, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../components/Card";
import { Button } from "../../components/Button";
import { KpStepNav } from "./KpStepNav";
import { KpReadinessCard } from "./KpReadinessCard";
import { ADMIN_KP_STEPS, fetchKpReadiness, type KpReadiness } from "./kpProcess";
import { PriceListAdmin } from "./PriceListAdmin";
import { KpTemplateEditor } from "./KpTemplateEditor";
import { KpPreview } from "./KpPreview";
import { DEFAULT_KP_TEMPLATE_V1 } from "./defaultTemplate";
import { ensurePdfBlocks } from "./kpPdfBlocks";
import type { KpInput, KpTemplateConfig, KpTemplateRecord, SpecItem } from "./types";

const DEMO_INPUT: KpInput = {
  clientName: "ООО «Ромашка»",
  clientInn: "7701234567",
  clientEmail: "it@romashka.ru",
  endpoints: 100,
  licenseType: "annual",
  supportTier: "standard",
};

const DEMO_ITEMS: SpecItem[] = [
  { id: "d1", name: "Лицензия — базовая", qty: 100, unitPrice: 1000, vatPercent: 20, source: "custom" },
  { id: "d2", name: "Техподдержка — стандарт", qty: 1, unitPrice: 50000, vatPercent: 20, source: "custom" },
];

const STEP_ICONS: Record<string, React.ReactNode> = {
  intro: <Sparkles size={16} />,
  price: <Package size={16} />,
  template: <FileText size={16} />,
  check: <ListOrdered size={16} />,
};

export function KpAdminWizard({
  templateRecord,
  onSave,
  onReload,
}: {
  templateRecord: KpTemplateRecord;
  onSave: (patch: { template_json: KpTemplateConfig; name: string }) => Promise<void>;
  onReload: () => void;
}) {
  const [step, setStep] = React.useState("intro");
  const [readiness, setReadiness] = React.useState<KpReadiness | null>(null);
  const completed = React.useMemo(() => {
    const s = new Set<string>();
    if (readiness?.priceCount) s.add("price");
    if (readiness?.hasTemplate && readiness.pdfBlocksEnabled >= 2) {
      s.add("template");
      s.add("check");
    }
    return s;
  }, [readiness]);

  async function refreshReadiness() {
    setReadiness(await fetchKpReadiness());
  }

  React.useEffect(() => {
    void refreshReadiness();
  }, [templateRecord?.id]);

  React.useEffect(() => {
    if (step === "check") void onReload();
  }, [step]);

  const stepIndex = ADMIN_KP_STEPS.findIndex((s) => s.id === step);
  const nextStep = ADMIN_KP_STEPS[stepIndex + 1]?.id;

  const previewTemplate = React.useMemo(() => {
    const json = templateRecord?.template_json;
    const base =
      json && typeof json === "object" ? ({ ...json } as KpTemplateConfig) : { ...DEFAULT_KP_TEMPLATE_V1 };
    base.pdfBlocks = ensurePdfBlocks(base);
    return base;
  }, [templateRecord?.id, templateRecord?.template_json]);

  function goNext() {
    if (nextStep) setStep(nextStep);
    void refreshReadiness();
  }

  return (
    <div className="grid gap-4">
      <Card className="neon-accent">
        <CardHeader>
          <div className="text-base font-extrabold">КП под ключ — настройка один раз</div>
          <div className="text-xs text-text2 mt-1">
            Администратор: прайс → шаблон → проверка. Менеджер в сделке: клиент → позиции → PDF.
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <KpStepNav steps={ADMIN_KP_STEPS} currentId={step} completedIds={completed} onSelect={setStep} />
          <KpReadinessCard readiness={readiness} onRefresh={() => void refreshReadiness()} />
        </CardContent>
      </Card>

      {step === "intro" ? (
        <Card>
          <CardContent className="pt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-card border border-border bg-[rgba(255,255,255,0.04)] p-4">
                <div className="text-xs font-bold uppercase text-primary mb-2">Роль администратора</div>
                <ol className="text-sm space-y-2 list-decimal pl-4 text-text2">
                  <li>Загрузить прайс (Excel/CSV)</li>
                  <li>Настроить шаблон PDF и поля формы</li>
                  <li>Проверить демо-PDF</li>
                </ol>
              </div>
              <div className="rounded-card border border-border bg-[rgba(255,255,255,0.04)] p-4">
                <div className="text-xs font-bold uppercase text-primary mb-2">Роль менеджера в сделке</div>
                <ol className="text-sm space-y-2 list-decimal pl-4 text-text2">
                  <li>Проверить данные клиента</li>
                  <li>Добавить позиции из прайса</li>
                  <li>Скачать PDF клиенту</li>
                </ol>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep("price")}>
                Начать настройку
                <ArrowRight size={16} className="ml-1" />
              </Button>
              {readiness?.ready ? (
                <span className="text-xs text-success self-center">Система готова — менеджеры могут собирать КП</span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "price" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {STEP_ICONS.price}
              <div>
                <div className="text-sm font-semibold">Шаг 1 — Прайс-лист</div>
                <div className="text-xs text-text2 mt-0.5">
                  Колонки: <strong>product_name</strong> (или «наименование»), <strong>price</strong> («цена»), опционально sku, vat_mode.
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PriceListAdmin embedded onChanged={() => void refreshReadiness()} />
            <div className="mt-4 flex justify-end">
              <Button onClick={goNext}>
                Далее: шаблон PDF
                <ArrowRight size={16} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "template" ? (
        <div className="grid gap-4">
          <KpTemplateEditor
            templateRecord={templateRecord}
            onSave={onSave}
            onReload={onReload}
            variant="wizard"
            onSaved={() => void refreshReadiness()}
          />
          <div className="flex justify-end">
            <Button onClick={goNext}>
              Далее: проверка
              <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "check" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {STEP_ICONS.check}
              <div>
                <div className="text-sm font-semibold">Шаг 4 — Проверка демо-КП</div>
                <div className="text-xs text-text2 mt-0.5">
                  Так же увидит клиент. Если всё верно — настройка завершена, можно собирать КП в сделках.
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-card border border-border bg-white overflow-x-auto max-h-[70vh] overflow-y-auto">
              <KpPreview
                template={previewTemplate}
                input={DEMO_INPUT}
                items={DEMO_ITEMS}
                dealId="KP_DEMO"
                mode="pdf"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep("template")}>
                Править шаблон
              </Button>
              <Button variant="secondary" onClick={() => setStep("price")}>
                Править прайс
              </Button>
            </div>
            {readiness?.ready ? (
              <div className="text-sm text-success font-semibold">
                Готово: откройте любую сделку → вкладка «КП» → 4 шага (клиент → позиции → условия → PDF).
              </div>
            ) : (
              <KpReadinessCard readiness={readiness} onRefresh={() => void refreshReadiness()} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
