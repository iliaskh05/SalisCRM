import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Inbox,
  LayoutDashboard,
  Trophy,
  Users,
  Building2,
  Wrench,
  FileText,
  Receipt,
  Banknote,
  HardHat,
  LogOut,
  Menu,
  Shield,
  X,
  CalendarDays,
  MessageSquare,
  Package,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { useLeadsInboxRealtime } from "@/hooks/useLeadsInboxRealtime";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  permission: Permission;
};

const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true, permission: "dashboard:view" },
  { to: "/demandes-devis", label: "Demandes de devis", icon: Inbox, permission: "leads:read" },
  { to: "/commerciaux", label: "Commerciaux", icon: Trophy, permission: "stats:view" },
  { to: "/prospects", label: "Prospects", icon: Users, permission: "leads:read" },
  { to: "/clients", label: "Clients", icon: Building2, permission: "clients:read" },
  { to: "/devis", label: "Devis", icon: FileText, permission: "quotes:read" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, permission: "interventions:read" },
  { to: "/interventions", label: "Interventions", icon: Wrench, permission: "interventions:read" },
  { to: "/prestataires", label: "Prestataires", icon: HardHat, permission: "providers:read" },
  { to: "/produits", label: "Produits", icon: Package, permission: "quotes:read" },
  { to: "/factures", label: "Factures", icon: Receipt, permission: "invoices:read" },
  { to: "/paiements", label: "Paiements", icon: Banknote, permission: "payments:read" },
  { to: "/chat", label: "Messages", icon: MessageSquare, permission: "dashboard:view" },
  { to: "/settings", label: "Paramètres", icon: Settings, permission: "users:manage" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((item) => (
        <RoleGate key={item.to} permission={item.permission}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-white",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        </RoleGate>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { profile, role, signOut, user } = useAuth();
  return (
    <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
      <div className="flex items-center gap-2">
        <Shield className="size-3.5" />
        <span>{role ? ROLE_LABELS[role] : "—"}</span>
      </div>
      <p className="mt-1 truncate">{profile?.display_name ?? user?.email}</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
        onClick={() => void signOut()}
      >
        <LogOut className="size-3.5" />
        Déconnexion
      </Button>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useLeadsInboxRealtime();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/" className="group block">
            <BrandLogo tone="dark" size="lg" className="group-hover:opacity-85" />
            <p className="mt-2.5 text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase">SalisCRM</p>
          </Link>
        </div>
        <NavItems />
        <SidebarFooter />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <BrandLogo tone="dark" variant="mark" size="md" />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-4" />
            </Button>
            <Link to="/" className="md:hidden">
              <BrandLogo variant="mark" size="sm" />
            </Link>
            <p className="hidden text-sm text-muted-foreground md:block">CRM interne — nettoyage de hottes</p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
