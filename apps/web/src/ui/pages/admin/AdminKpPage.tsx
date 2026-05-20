import { AdminPageShell } from "../../layout/AdminPageShell";
import { KpAdminPanel } from "../../modules/kp/KpAdminPanel";

export function AdminKpPage() {
  return (
    <AdminPageShell
      title="Коммерческие предложения"
      subtitle="Мастер настройки: прайс → шаблон PDF → проверка. В сделке менеджер собирает КП за 4 шага."
    >
      <KpAdminPanel />
    </AdminPageShell>
  );
}
