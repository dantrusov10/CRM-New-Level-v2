import { AdminPageShell } from "../../layout/AdminPageShell";
import { KpAdminPanel } from "../../modules/kp/KpAdminPanel";

export function AdminKpPage() {
  return (
    <AdminPageShell
      title="Коммерческие предложения"
      subtitle="Шаблон блоков, прайс-лист и сборка PDF по сделке"
    >
      <KpAdminPanel />
    </AdminPageShell>
  );
}
