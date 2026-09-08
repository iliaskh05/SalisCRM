import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  FileText,
  HardHat,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Trophy,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo/store";
import { isWebsiteQuoteRequest } from "@/lib/quote-requests/source";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  group: string;
};

const MANAGEMENT_NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true, group: "Pilotage" },
  { to: "/demandes-devis", label: "Demandes de devis", icon: Inbox, group: "Commercial" },
  { to: "/commerciaux", label: "Commerciaux", icon: Trophy, group: "Commercial" },
  { to: "/prospects", label: "Prospects", icon: Users, group: "Commercial" },
  { to: "/clients", label: "Clients", icon: Building2, group: "Commercial" },
  { to: "/devis", label: "Devis", icon: FileText, group: "Commercial" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, group: "Opérations" },
  { to: "/interventions", label: "Interventions", icon: Wrench, group: "Opérations" },
  { to: "/prestataires", label: "Prestataires", icon: HardHat, group: "Ressources" },
  { to: "/produits", label: "Produits", icon: Package, group: "Ressources" },
  { to: "/factures", label: "Factures", icon: Receipt, group: "Finance" },
  { to: "/paiements", label: "Paiements", icon: Wallet, group: "Finance" },
  { to: "/chat", label: "Messages", icon: MessageSquare, group: "Communication" },
  { to: "/settings", label: "Paramètres", icon: Settings, group: "Administration" },
];

const PROVIDER_NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true, group: "Terrain" },
  { to: "/interventions", label: "Mes interventions", icon: Wrench, group: "Terrain" },
  { to: "/agenda", label: "Mon agenda", icon: CalendarDays, group: "Terrain" },
  { to: "/chat", label: "Messages", icon: MessageSquare, group: "Communication" },
];

export function DemoShell() {
  const { currentUser, isProvider, state, markNotificationsRead, logout } = useDemoStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const nav = isProvider ? PROVIDER_NAV : MANAGEMENT_NAV;
  const unreadNotifs = state.notifications.filter(
    (n) =>
      !n.read &&
      (n.role === "all" || n.role === currentUser?.role || (!isProvider && n.role === "admin")),
  );
  const unreadMessages = useMemo(() => {
    const uid = currentUser?.id;
    if (!uid) return 0;
    return state.messages.filter((m) => !m.readBy.includes(uid)).length;
  }, [state.messages, currentUser]);
  const newRequests = state.leads.filter((l) => isWebsiteQuoteRequest(l) && l.status === "new").length;

  const grouped = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-30 flex h-8 items-center justify-center bg-[oklch(0.18_0.035_220)] px-3 text-[11px] font-medium tracking-wide text-white/80">
        Prototype de démonstration <span className="mx-2 text-teal-300">—</span> SalisCRM · Salis 3 Hottes
        <span className="ml-2 hidden text-white/50 sm:inline">Données fictives, cohérentes et persistées localement</span>
      </div>
      <div className="flex min-h-[calc(100vh-2rem)]">
        <aside className="no-print hidden w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
          <Link to="/" className="group mb-7 block px-2 pt-1">
            <BrandLogo tone="dark" size="lg" className="group-hover:opacity-85" />
            <p className="mt-2.5 px-1 text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase">SalisCRM</p>
          </Link>
          <nav className="flex-1 space-y-4 overflow-y-auto">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.16em] text-white/35 uppercase">{group}</p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          isActive ? "bg-white/12 text-white shadow-sm" : "text-white/60 hover:bg-white/7 hover:text-white",
                        )
                      }
                    >
                      <item.icon className="size-4" />
                      {item.label}
                      {item.to === "/chat" && unreadMessages > 0 ? (
                        <span className="ml-auto rounded-full bg-teal-400/90 px-1.5 text-[10px] font-bold text-ink">
                          {unreadMessages}
                        </span>
                      ) : null}
                      {item.to === "/demandes-devis" && newRequests > 0 ? (
                        <span className="ml-auto rounded-full bg-teal-400/90 px-1.5 text-[10px] font-bold text-ink">
                          {newRequests}
                        </span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-teal-500 font-semibold text-white">
                {(currentUser?.name ?? "S").slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{currentUser?.name}</p>
                <p className="text-[10px] text-white/50">{currentUser ? ROLE_LABELS[currentUser.role] : ""}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="size-3.5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {mobileOpen ? (
          <div className="no-print fixed inset-0 z-40 md:hidden">
            <button type="button" className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-10 flex h-full w-72 flex-col bg-sidebar p-4 text-sidebar-foreground">
              <div className="mb-4 flex items-center justify-between px-2">
                <Link to="/" onClick={() => setMobileOpen(false)}>
                  <BrandLogo tone="dark" variant="mark" size="md" />
                </Link>
                <Button variant="ghost" size="sm" className="text-white" onClick={() => setMobileOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <nav className="space-y-1">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={"end" in item ? item.end : false}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                        isActive ? "bg-white/12 text-white" : "text-white/70",
                      )
                    }
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">
          <header className="no-print flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur md:px-9">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="md:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="size-4" />
              </Button>
              <Link to="/" className="md:hidden">
                <BrandLogo variant="mark" size="sm" />
              </Link>
              <div className="hidden md:block">
                <p className="text-sm text-muted-foreground">Mardi 8 septembre 2026</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    setBellOpen((v) => !v);
                    markNotificationsRead();
                  }}
                >
                  <Bell className="size-5" />
                  {unreadNotifs.length > 0 ? (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-teal-500" />
                  ) : null}
                </button>
                {bellOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-card p-2 shadow-xl">
                    {state.notifications.slice(0, 6).map((n) => (
                      <Link
                        key={n.id}
                        to={n.href}
                        onClick={() => setBellOpen(false)}
                        className="block rounded-lg px-3 py-2 hover:bg-muted"
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser ? ROLE_LABELS[currentUser.role] : ""}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                {(currentUser?.name ?? "S").slice(0, 1)}
                {(currentUser?.name.split(" ")[1] ?? "D").slice(0, 1)}
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-7xl p-4 md:p-9">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
