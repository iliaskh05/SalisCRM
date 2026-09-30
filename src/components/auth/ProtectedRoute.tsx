import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Permission } from "@/lib/auth/permissions";

export function ProtectedRoute({
  permission,
  children,
}: {
  permission?: Permission;
  children?: React.ReactNode;
}) {
  const { loading, isAuthenticated, isStaff, hasPermission, mfaEnrollmentRequired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement de la session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isStaff) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Double authentification exigée par la direction : seule la page d'activation reste accessible
  if (mfaEnrollmentRequired && location.pathname !== "/securite") {
    return <Navigate to="/securite" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RoleGate({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
