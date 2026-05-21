import React, { Suspense } from "react";
import { AdminPageShell } from "../../layout/AdminPageShell";

const KpAdminPanel = React.lazy(() =>
  import("../../modules/kp/KpAdminPanel").then((m) => ({ default: m.KpAdminPanel })),
);

export function AdminKpPage() {
  return (
    <AdminPageShell
      title="Коммерческие предложения"
      subtitle="КП и ТКП: прайс → шаблоны (оформление + тип) → проверка. В сделке — выбор документа и 4 шага."
    >
      <Suspense fallback={<div className="py-8 text-sm text-text2">Загрузка редактора шаблонов…</div>}>
        <KpAdminPanel />
      </Suspense>
    </AdminPageShell>
  );
}
