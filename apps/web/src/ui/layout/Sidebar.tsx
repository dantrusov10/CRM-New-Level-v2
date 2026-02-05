import React from "react";
import { NavLink } from "react-router-dom";
import { Building2, KanbanSquare, LayoutGrid, Settings, Upload } from "lucide-react";
import clsx from "clsx";
import type { PermissionMatrix } from "../../lib/rbac";
import { can } from "../../lib/rbac";

const Item = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        "flex items-center gap-3 rounded-card px-3 py-2 text-sm",
        isActive ? "bg-rowSelected border border-border" : "hover:bg-rowHover"
      )
    }
  >
    <Icon size={18} />
    <span>{label}</span>
  </NavLink>
);

export function Sidebar({ perms }: { perms: PermissionMatrix }) {
  return (
    <aside className="min-h-screen border-r border-border bg-card p-4">
      <div className="mb-5">
        <div className="text-lg font-semibold leading-none">Решение</div>
        <div className="text-xs text-text2 mt-1">CRM для сложных продаж</div>
      </div>

      <div className="space-y-1">
        {can(perms, "deals", "read") ? <Item to="/deals" icon={LayoutGrid} label="Сделки" /> : null}
        {can(perms, "deals", "read") ? <Item to="/kanban" icon={KanbanSquare} label="Канбан" /> : null}
        {can(perms, "companies", "read") ? <Item to="/companies" icon={Building2} label="Компании" /> : null}
        {can(perms, "import_export", "read") ? <Item to="/import-export" icon={Upload} label="Импорт/Экспорт" /> : null}
      </div>

      {can(perms, "admin", "read") ? (
        <div className="mt-6 border-t border-border pt-4">
          <div className="text-xs font-semibold text-text2 mb-2">Админ</div>
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
