import { AdminPageShell } from "../../layout/AdminPageShell";
import { KpAdminPanel } from "../../modules/kp/KpAdminPanel";

export function AdminKpPage() {
  return (
    <AdminPageShell
      title="Коммерческие предложения"
      subtitle="КП и ТКП: прайс → шаблоны (оформление + тип) → проверка. В сделке — выбор документа и 4 шага."
    >
      <KpAdminPanel />
    </AdminPageShell>
  );
}
