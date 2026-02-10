import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building2, KanbanSquare, LayoutDashboard, LayoutGrid, Settings, Upload, CalendarDays } from "lucide-react";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";
import logo from "../../assets/newlevel-logo.png";

const Item = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `cockpit-nav-item ${isActive ? "active" : ""}`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </NavLink>
);

export function Sidebar({ perms }: { perms: PermissionMatrix }) {
  const nav = useNavigate();
  return (
    <aside className="cockpit-sidebar p-4 overflow-y-auto">
      <div className="mb-5">
        <button
          type="button"
          onClick={() => nav("/dashboard")}
          className="flex items-center gap-3 text-left w-full hover:opacity-95 active:opacity-90"
          title="На главную (Dashboard)"
        >
          <img src={logo} alt="NewLevel CRM" className="w-10 h-10 rounded-2xl border border-[rgba(255,255,255,0.12)]" />
          <div>
            <div className="text-base font-extrabold leading-none">NewLevel CRM</div>
            <div className="text-xs mt-1 muted font-semibold">Command center для продаж</div>
          </div>
        </button>
      </div>

      <div className="space-y-1">
        {can(perms, "deals", "read") ? <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" /> : null}
        {can(perms, "deals", "read") ? <Item to="/deals" icon={LayoutGrid} label="Сделки" /> : null}
        {can(perms, "deals", "read") ? <Item to="/kanban" icon={KanbanSquare} label="Канбан" /> : null}
        {can(perms, "deals", "read") ? <Item to="/calendar" icon={CalendarDays} label="Календарь" /> : null}
        {can(perms, "companies", "read") ? <Item to="/companies" icon={Building2} label="Компании" /> : null}
        {can(perms, "import_export", "read") ? <Item to="/import-export" icon={Upload} label="Импорт/Экспорт" /> : null}
      </div>

      {can(perms, "admin", "read") ? (
        <div className="mt-6 border-t border-[rgba(255,255,255,0.12)] pt-4">
          <div className="text-xs font-extrabold muted mb-2 tracking-wide uppercase">Админ</div>
          <div className="space-y-1">
            <Item to="/admin/users" icon={Settings} label="Пользователи" />
            <Item to="/admin/funnel" icon={Settings} label="Воронка" />
            <Item to="/admin/fields" icon={Settings} label="Поля" />
            <Item to="/admin/parsers" icon={Settings} label="Парсеры/AI" />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
