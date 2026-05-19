import React from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, Plus, Upload, Download, LogOut, Menu } from "lucide-react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../../app/AuthProvider";
import { FiltersModal } from "../modals/FiltersModal";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";
import { NotificationsBell } from "../components/NotificationsBell";

function titleByPath(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "Дашборд";
  if (pathname.startsWith("/calendar")) return "Календарь";
  if (pathname.startsWith("/search")) return "Поиск";
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
  onMenuOpen,
  perms,
}: {
  pathname: string;
  onCreateCompany: () => void;
  onCreateDeal: () => void;
  onImport: () => void;
  onExport: () => void;
  onMenuOpen?: () => void;
  perms: PermissionMatrix;
}) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const nav = useNavigate();
  const { logout } = useAuth();

  return (
    <header className="cockpit-topbar">
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-[rgba(51,215,255,0.18)] bg-[linear-gradient(90deg,rgba(17,24,39,0.46),rgba(30,58,138,0.24),rgba(17,24,39,0.46))]">
        {onMenuOpen ? (
          <button type="button" className="ui-btn ui-icon-btn md:hidden" onClick={onMenuOpen} aria-label="Меню">
            <Menu size={18} />
          </button>
        ) : null}
        <div className="text-xs font-extrabold tracking-wide uppercase min-w-0 flex-1 sm:flex-none sm:w-[170px] flex items-center gap-2">
          <span className="brand-dot" />
          {titleByPath(pathname)}
        </div>
        <div className="order-3 w-full sm:order-none sm:flex-1 flex items-center gap-2 min-w-0">
          <div className="relative w-full sm:max-w-[520px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(226,232,240,0.72)]">
              <Search size={16} />
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск (глобальный)"
              className="pl-9 h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") nav(`/search?q=${encodeURIComponent(query)}`);
              }}
            />
          </div>

          <button
            className="ui-btn ui-icon-btn border-[rgba(51,215,255,0.3)] bg-[rgba(51,215,255,0.12)]"
            onClick={() => setFiltersOpen(true)}
            title="Фильтры"
            aria-label="Фильтры"
          >
            <Filter size={18} />
          </button>

          {/* Кнопку "Настройки" убрали из хедера (дублировала левое меню и путала) */}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <NotificationsBell />
          {can(perms, "import_export", "read") ? (
            <Button small variant="secondary" onClick={onImport} disabled={!can(perms, "import_export", "create")} title="Импорт">
              <Upload size={16} />
              <span className="hidden lg:inline">Импорт</span>
            </Button>
          ) : null}
          {can(perms, "import_export", "read") ? (
            <Button small variant="secondary" onClick={onExport} title="Экспорт">
              <Download size={16} />
              <span className="hidden lg:inline">Экспорт</span>
            </Button>
          ) : null}
          {can(perms, "companies", "create") ? (
            <Button small variant="secondary" onClick={onCreateCompany} title="Компания">
              <Plus size={16} />
              <span className="hidden lg:inline">Компания</span>
            </Button>
          ) : null}
          {can(perms, "deals", "create") ? (
            <Button small onClick={onCreateDeal} title="Сделка">
              <Plus size={16} />
              <span className="hidden sm:inline">Сделка</span>
            </Button>
          ) : null}
          <button className="ui-btn ui-icon-btn border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.18)]" title="Выйти" onClick={logout} aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} pathname={pathname} />
    </header>
  );
}
