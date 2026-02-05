import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CreateCompanyModal } from "../modals/CreateCompanyModal";
import { CreateDealModal } from "../modals/CreateDealModal";
import { useAuth } from "../../app/AuthProvider";
import { usePermissions } from "../data/hooks";
import { can } from "../../lib/rbac";

export function AppLayout() {
  const [openCompany, setOpenCompany] = React.useState(false);
  const [openDeal, setOpenDeal] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const permsQ = usePermissions(user?.role);
  const perms = permsQ.data ?? {
    deals: { read: true, create: true, update: true },
    companies: { read: true, create: true, update: true },
    import_export: { read: true },
    admin: { read: false },
  };

  React.useEffect(() => {
    // Screen-level RBAC (best effort). If no access – redirect to the first allowed section.
    const p = location.pathname;
    const wantAdmin = p.startsWith("/admin");
    const wantCompanies = p.startsWith("/companies");
    const wantImport = p.startsWith("/import-export");
    const wantDeals = p.startsWith("/deals") || p.startsWith("/kanban") || p === "/";

    if (wantAdmin && !can(perms, "admin", "read")) {
      if (can(perms, "deals", "read")) navigate("/deals", { replace: true });
      else if (can(perms, "companies", "read")) navigate("/companies", { replace: true });
      else if (can(perms, "import_export", "read")) navigate("/import-export", { replace: true });
      else navigate("/login", { replace: true });
    }
    if (wantCompanies && !can(perms, "companies", "read")) {
      if (can(perms, "deals", "read")) navigate("/deals", { replace: true });
    }
    if (wantImport && !can(perms, "import_export", "read")) {
      if (can(perms, "deals", "read")) navigate("/deals", { replace: true });
    }
    if (wantDeals && !can(perms, "deals", "read")) {
      if (can(perms, "companies", "read")) navigate("/companies", { replace: true });
    }
  }, [location.pathname, navigate, perms]);

  return (
    <div className="min-h-screen w-full">
      <div className="grid grid-cols-[260px_1fr]">
        <Sidebar perms={perms} />
        <div className="min-h-screen">
          <Header
            pathname={location.pathname}
            onCreateCompany={() => setOpenCompany(true)}
            onCreateDeal={() => setOpenDeal(true)}
            onImport={() => navigate("/import-export")}
            onExport={() => navigate("/import-export")}
            perms={perms}
          />
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <CreateCompanyModal open={openCompany} onClose={() => setOpenCompany(false)} />
      <CreateDealModal open={openDeal} onClose={() => setOpenDeal(false)} />
    </div>
  );
}
