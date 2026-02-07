import React from "react";
import { Card, CardContent, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { ImportModal } from "../modals/ImportModal";
import { ExportModal } from "../modals/ExportModal";

export function ImportExportPage() {
  const [openImport, setOpenImport] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);

  return (
    <div className="grid gap-4">
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
