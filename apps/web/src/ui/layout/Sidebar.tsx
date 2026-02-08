import React from "react";
import { NavLink } from "react-router-dom";
import { Building2, KanbanSquare, LayoutGrid, Settings, Upload } from "lucide-react";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";

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
  return (
    <aside className="cockpit-sidebar p-4 overflow-y-auto">
      <div className="mb-5">
        <div className="text-lg font-extrabold leading-none">Решение</div>
        <div className="text-xs mt-1 muted font-semibold">CRM для сложных продаж</div>
      </div>

      <div className="space-y-1">
        {can(perms, "deals", "read") ? <Item to="/deals" icon={LayoutGrid} label="Сделки" /> : null}
        {can(perms, "deals", "read") ? <Item to="/kanban" icon={KanbanSquare} label="Канбан" /> : null}
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
