import React from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, Settings2, Plus, Upload, Download, LogOut } from "lucide-react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../../app/AuthProvider";
import { FiltersModal } from "../modals/FiltersModal";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";

function titleByPath(pathname: string) {
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
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="text-base font-semibold w-[160px]">{titleByPath(pathname)}</div>

        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full max-w-[520px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text2">
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

          <button className="h-10 w-10 rounded-card border border-border bg-white hover:bg-rowHover flex items-center justify-center" onClick={() => setFiltersOpen(true)} title="Фильтры">
            <Filter size={18} />
          </button>

          <button className="h-10 w-10 rounded-card border border-border bg-white hover:bg-rowHover flex items-center justify-center" title="Настройки">
            <Settings2 size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {can(perms, "import_export", "read") ? (
            <Button variant="secondary" onClick={onImport} disabled={!can(perms, "import_export", "create")}><Upload size={16}/>Импорт</Button>
          ) : null}
          {can(perms, "import_export", "read") ? (
            <Button variant="secondary" onClick={onExport}><Download size={16}/>Экспорт</Button>
          ) : null}
          {can(perms, "companies", "create") ? (
            <Button variant="secondary" onClick={onCreateCompany}><Plus size={16}/>Компания</Button>
          ) : null}
          {can(perms, "deals", "create") ? (
            <Button onClick={onCreateDeal}><Plus size={16}/>Сделка</Button>
          ) : null}
          <button className="h-10 w-10 rounded-card border border-border bg-white hover:bg-rowHover flex items-center justify-center" title="Выйти" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} pathname={pathname} />
    </header>
  );
}
