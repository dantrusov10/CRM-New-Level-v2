import React from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, Plus, Upload, Download, LogOut } from "lucide-react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../../app/AuthProvider";
import { FiltersModal } from "../modals/FiltersModal";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";
import { NotificationsBell } from "../components/NotificationsBell";

function titleByPath(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/calendar")) return "Календарь";
  if (pathname.startsWith("/kanban")) return "Канбан";
  if (pathname.startsWith("/companies")) return "Компании";
  if (pathname.startsWith("/admin")) return "Админ";
  return "Сделки";
}

export function Header({
  pathname,
  onCreateCompany,
  onCreateDeal,
  onImport,
  onExport,
  perms,
}: {
  pathname: string;
  onCreateCompany: () => void;
  onCreateDeal: () => void;
  onImport: () => void;
  onExport: () => void;
  perms: PermissionMatrix;
}) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const nav = useNavigate();
  const { logout } = useAuth();

  return (
    <header className="cockpit-topbar">
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="text-sm font-extrabold tracking-wide uppercase w-[160px] flex items-center gap-2">
          <span className="brand-dot" />
          {titleByPath(pathname)}
        </div>

        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full max-w-[560px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(226,232,240,0.72)]">
              <Search size={16} />
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск (глобальный)"
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") nav(`/deals?search=${encodeURIComponent(query)}`);
              }}
            />
          </div>

          <button
            className="ui-btn ui-icon-btn"
            onClick={() => setFiltersOpen(true)}
            title="Фильтры"
            aria-label="Фильтры"
          >
            <Filter size={18} />
          </button>

          {/* Кнопку "Настройки" убрали из хедера (дублировала левое меню и путала) */}
        </div>

        <div className="flex items-center gap-2">
          <NotificationsBell />
          {can(perms, "import_export", "read") ? (
            <Button variant="secondary" onClick={onImport} disabled={!can(perms, "import_export", "create")}>
              <Upload size={16} />
              Импорт
            </Button>
          ) : null}
          {can(perms, "import_export", "read") ? (
            <Button variant="secondary" onClick={onExport}>
              <Download size={16} />
              Экспорт
            </Button>
          ) : null}
          {can(perms, "companies", "create") ? (
            <Button variant="secondary" onClick={onCreateCompany}>
              <Plus size={16} />
              Компания
            </Button>
          ) : null}
          {can(perms, "deals", "create") ? (
            <Button onClick={onCreateDeal}>
              <Plus size={16} />
              Сделка
            </Button>
          ) : null}
          <button className="ui-btn ui-icon-btn" title="Выйти" onClick={logout} aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} pathname={pathname} />
    </header>
  );
}
