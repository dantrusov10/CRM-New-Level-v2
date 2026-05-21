import React, { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./ui/layout/AppLayout";
import { LoginPage } from "./ui/pages/LoginPage";
import { RegisterTenantPage } from "./ui/pages/RegisterTenantPage";
import { Protected } from "./ui/layout/Protected";
import { AdminOnly } from "./ui/layout/AdminOnly";
import { RouteErrorFallback } from "./ui/components/RouteErrorFallback";
import { lazyImportWithReload } from "./lib/chunkReload";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-text2">
      <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 bg-[rgba(255,255,255,0.06)]">
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
        Загрузка…
      </div>
    </div>
  );
}

function lazyNamed<T extends Record<string, React.ComponentType<object>>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  const Comp = React.lazy(() =>
    lazyImportWithReload(factory)().then((m) => ({
      default: m[name] as React.ComponentType<object>,
    })),
  );
  return (
    <Suspense fallback={<PageLoader />}>
      <Comp />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorFallback /> },
  { path: "/register", element: <RegisterTenantPage />, errorElement: <RouteErrorFallback /> },
  {
    path: "/",
    element: (
      <Protected>
        <AppLayout />
      </Protected>
    ),
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: lazyNamed(() => import("./ui/pages/DashboardPage"), "DashboardPage") },
      { path: "deals", element: lazyNamed(() => import("./ui/pages/deals/DealsTablePage"), "DealsTablePage") },
      { path: "kanban", element: lazyNamed(() => import("./ui/pages/deals/DealsKanbanPage"), "DealsKanbanPage") },
      { path: "deals/:id", element: lazyNamed(() => import("./ui/pages/deals/DealDetailPage"), "DealDetailPage") },
      { path: "companies", element: lazyNamed(() => import("./ui/pages/companies/CompaniesPage"), "CompaniesPage") },
      { path: "companies/:id", element: lazyNamed(() => import("./ui/pages/companies/CompanyDetailPage"), "CompanyDetailPage") },
      { path: "import-export", element: lazyNamed(() => import("./ui/pages/ImportExportPage"), "ImportExportPage") },
      { path: "calendar", element: lazyNamed(() => import("./ui/pages/CalendarPage"), "CalendarPage") },
      { path: "search", element: lazyNamed(() => import("./ui/pages/GlobalSearchPage"), "GlobalSearchPage") },
      { path: "admin/users", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminUsersPage"), "AdminUsersPage")}</AdminOnly> },
      { path: "admin/funnel", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminFunnelPage"), "AdminFunnelPage")}</AdminOnly> },
      { path: "admin/fields", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminFieldsPage"), "AdminFieldsPage")}</AdminOnly> },
      { path: "admin/parsers", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminParsersPage"), "AdminParsersPage")}</AdminOnly> },
      { path: "admin/products", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminProductsPage"), "AdminProductsPage")}</AdminOnly> },
      { path: "admin/kp", element: <AdminOnly>{lazyNamed(() => import("./ui/pages/admin/AdminKpPage"), "AdminKpPage")}</AdminOnly> },
      { path: "admin", element: <Navigate to="/admin/users" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
