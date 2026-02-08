import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./ui/layout/AppLayout";
import { LoginPage } from "./ui/pages/LoginPage";
import { DashboardPage } from "./ui/pages/DashboardPage";
import { DealsTablePage } from "./ui/pages/deals/DealsTablePage";
import { DealsKanbanPage } from "./ui/pages/deals/DealsKanbanPage";
import { DealDetailPage } from "./ui/pages/deals/DealDetailPage";
import { CompaniesPage } from "./ui/pages/companies/CompaniesPage";
import { CompanyDetailPage } from "./ui/pages/companies/CompanyDetailPage";
import { AdminUsersPage } from "./ui/pages/admin/AdminUsersPage";
import { AdminFunnelPage } from "./ui/pages/admin/AdminFunnelPage";
import { AdminFieldsPage } from "./ui/pages/admin/AdminFieldsPage";
import { AdminParsersPage } from "./ui/pages/admin/AdminParsersPage";
import { ImportExportPage } from "./ui/pages/ImportExportPage";
import { Protected } from "./ui/layout/Protected";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <Protected>
        <AppLayout />
      </Protected>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "deals", element: <DealsTablePage /> },
      { path: "kanban", element: <DealsKanbanPage /> },
      { path: "deals/:id", element: <DealDetailPage /> },
      { path: "companies", element: <CompaniesPage /> },
      { path: "companies/:id", element: <CompanyDetailPage /> },
      { path: "import-export", element: <ImportExportPage /> },
      { path: "admin/users", element: <AdminUsersPage /> },
      { path: "admin/funnel", element: <AdminFunnelPage /> },
      { path: "admin/fields", element: <AdminFieldsPage /> },
      { path: "admin/parsers", element: <AdminParsersPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
