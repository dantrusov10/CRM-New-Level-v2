import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../app/AuthProvider";
import { usePermissions } from "../../data/hooks";
import { can } from "../../../lib/rbac";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: perms, isLoading } = usePermissions(user?.role);

  if (loading || isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(perms, "admin", "read")) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

