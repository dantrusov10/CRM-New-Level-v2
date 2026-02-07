import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CreateCompanyModal } from "../modals/CreateCompanyModal";
import { CreateDealModal } from "../modals/CreateDealModal";
import { ImportModal } from "../modals/ImportModal";
import { ExportModal } from "../modals/ExportModal";
import { useAuth } from "../../app/AuthProvider";
import { usePermissions } from "../data/hooks";
import { can } from "../../lib/rbac";

const SIDEBAR_W = 260;

export function AppLayout() {
  const [openCompany, setOpenCompany] = React.useState(false);
  const [openDeal, setOpenDeal] = React.useState(false);
  const [openImport, setOpenImport] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);
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
    <div className="min-h-screen w-full bg-bg">
      {/* Sidebar is fixed, content scrolls independently */}
      <div className="fixed left-0 top-0 h-screen" style={{ width: SIDEBAR_W }}>
        <Sidebar perms={perms} />
      </div>

      <div className="min-h-screen" style={{ marginLeft: SIDEBAR_W }}>
        <Header
          pathname={location.pathname}
          onCreateCompany={() => setOpenCompany(true)}
          onCreateDeal={() => setOpenDeal(true)}
          onImport={() => setOpenImport(true)}
          onExport={() => setOpenExport(true)}
          perms={perms}
        />

        {/* Page content scrolls; header stays sticky */}
        <main className="p-6 min-w-0">
          <Outlet />
        </main>
      </div>

      <CreateCompanyModal open={openCompany} onClose={() => setOpenCompany(false)} />
      <CreateDealModal open={openDeal} onClose={() => setOpenDeal(false)} />
      <ImportModal open={openImport} onClose={() => setOpenImport(false)} />
      <ExportModal open={openExport} onClose={() => setOpenExport(false)} />
    </div>
  );
}
