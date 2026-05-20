import React from "react";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { ImportModal } from "../modals/ImportModal";
import { ExportModal } from "../modals/ExportModal";
import {
  downloadBundleImportTemplate,
  downloadCompanyImportTemplate,
  downloadDealImportTemplate,
} from "../../lib/importTemplates";
import { toast } from "../../lib/toast";

export function ImportExportPage() {
  const [openImport, setOpenImport] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);
  const [tplBusy, setTplBusy] = React.useState<string | null>(null);

  async function runTemplate(kind: "bundle" | "deal" | "company") {
    setTplBusy(kind);
    try {
      if (kind === "bundle") await downloadBundleImportTemplate();
      else if (kind === "deal") await downloadDealImportTemplate();
      else await downloadCompanyImportTemplate();
      toast.success("Шаблон скачан");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось скачать шаблон");
    } finally {
      setTplBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Шаблоны импорта</div>
          <div className="text-xs text-text2 mt-1">
            XLSX с актуальными колонками из админки полей. После импорта — отчёт по строкам с ошибками (CSV/XLSX).
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!!tplBusy}
              onClick={() => void runTemplate("bundle")}
            >
              {tplBusy === "bundle" ? "…" : "Связка (компания+сделка+контакты)"}
            </Button>
            <Button variant="secondary" disabled={!!tplBusy} onClick={() => void runTemplate("deal")}>
              {tplBusy === "deal" ? "…" : "Только сделки"}
            </Button>
            <Button variant="secondary" disabled={!!tplBusy} onClick={() => void runTemplate("company")}>
              {tplBusy === "company" ? "…" : "Только компании"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Импорт</div>
          <div className="text-xs text-text2 mt-1">CSV / XLSX · маппинг полей · предпросмотр · лог ошибок · массовое обновление по ID.</div>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpenImport(true)}>Открыть импорт</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Экспорт</div>
          <div className="text-xs text-text2 mt-1">Человекочитаемые поля · учёт текущих фильтров · пресеты (локально).</div>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpenExport(true)}>Открыть экспорт</Button>
        </CardContent>
      </Card>

      <ImportModal open={openImport} onClose={() => setOpenImport(false)} />
      <ExportModal open={openExport} onClose={() => setOpenExport(false)} />
    </div>
  );
}
