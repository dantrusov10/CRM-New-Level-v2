import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/Button";
import type { KpReadiness } from "./kpProcess";

export function KpReadinessCard({
  readiness,
  showAdminLink,
  onRefresh,
}: {
  readiness: KpReadiness | null;
  showAdminLink?: boolean;
  onRefresh?: () => void;
}) {
  if (!readiness) {
    return <div className="text-sm text-text2">Проверка готовности…</div>;
  }

  if (readiness.ready) {
    return (
      <div className="rounded-card border border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.12)] p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">КП настроено и готово к работе</div>
            <div className="text-xs text-text2 mt-1">
              Прайс: {readiness.priceCount} поз. · Блоков PDF: {readiness.pdfBlocksEnabled}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.1)] p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">КП ещё не готово к сборке</div>
          <ul className="mt-2 text-xs text-text2 list-disc pl-4 space-y-1">
            {readiness.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {showAdminLink ? (
              <Link to="/admin/kp">
                <Button small variant="primary">Открыть настройку КП</Button>
              </Link>
            ) : null}
            {onRefresh ? (
              <Button small variant="secondary" onClick={onRefresh}>
                Обновить статус
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
