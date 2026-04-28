import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building2, KanbanSquare, LayoutDashboard, LayoutGrid, Settings, Upload, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";
import logo from "../../assets/newlevel-logo.png";

const Item = ({ to, icon: Icon, label, collapsed }: { to: string; icon: LucideIcon; label: string; collapsed?: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `cockpit-nav-item ${isActive ? "active neon-accent" : ""}`}
    title={collapsed ? label : undefined}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-[rgba(51,215,255,0.9)] shadow-[0_0_10px_rgba(51,215,255,0.8)]" />
    <Icon size={18} />
    {!collapsed ? <span>{label}</span> : null}
  </NavLink>
);

export function Sidebar({ perms, collapsed }: { perms: PermissionMatrix; collapsed?: boolean }) {
  const nav = useNavigate();
  return (
    <aside className="cockpit-sidebar p-3 overflow-y-auto border-r border-[rgba(51,215,255,0.18)] shadow-[0_0_28px_rgba(45,123,255,0.14)]">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => nav("/dashboard")}
          className="flex items-center gap-2.5 text-left w-full hover:opacity-95 active:opacity-90 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-2"
          title="На главную (Dashboard)"
        >
          <img src={logo} alt="NewLevel CRM" className="w-9 h-9 rounded-xl border border-[rgba(51,215,255,0.35)] shadow-[0_0_20px_rgba(51,215,255,0.2)]" />
          {!collapsed ? <div>
            <div className="text-sm font-extrabold leading-none">NewLevel CRM</div>
            <div className="text-[11px] mt-1 muted font-semibold">Command center</div>
          </div> : null}
        </button>
      </div>

      <div className="space-y-1">
        {can(perms, "deals", "read") ? <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} /> : null}
        {can(perms, "deals", "read") ? <Item to="/deals" icon={LayoutGrid} label="Сделки" collapsed={collapsed} /> : null}
        {can(perms, "deals", "read") ? <Item to="/kanban" icon={KanbanSquare} label="Канбан" collapsed={collapsed} /> : null}
        {can(perms, "deals", "read") ? <Item to="/calendar" icon={CalendarDays} label="Календарь" collapsed={collapsed} /> : null}
        {can(perms, "companies", "read") ? <Item to="/companies" icon={Building2} label="Компании" collapsed={collapsed} /> : null}
        {can(perms, "import_export", "read") ? <Item to="/import-export" icon={Upload} label="Импорт/Экспорт" collapsed={collapsed} /> : null}
      </div>

      {can(perms, "admin", "read") ? (
        <div className="mt-6 border-t border-[rgba(255,255,255,0.12)] pt-4">
          {!collapsed ? <div className="text-xs font-extrabold muted mb-2 tracking-wide uppercase">Админ</div> : null}
          <div className="space-y-1">
            <Item to="/admin/users" icon={Settings} label="Пользователи" collapsed={collapsed} />
            <Item to="/admin/funnel" icon={Settings} label="Воронка" collapsed={collapsed} />
            <Item to="/admin/fields" icon={Settings} label="Поля" collapsed={collapsed} />
            <Item to="/admin/parsers" icon={Settings} label="Парсеры/AI" collapsed={collapsed} />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
