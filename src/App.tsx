import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { getSupabaseConfigStatus } from "@/lib/supabase/client";
import { SetupPage } from "@/pages/SetupPage";
import { LoginPage } from "@/pages/LoginPage";
const SetPasswordPage = lazy(() => import("@/pages/SetPasswordPage").then((m) => ({ default: m.SetPasswordPage })));
const AccountSecurityPage = lazy(() => import("@/pages/AccountSecurityPage").then((m) => ({ default: m.AccountSecurityPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazy(() => import("@/pages/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })));
const CommercialsPage = lazy(() => import("@/pages/commercials/CommercialsPage").then((m) => ({ default: m.CommercialsPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AgendaPage = lazy(() => import("@/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const CatalogPage = lazy(() => import("@/pages/ops/ExtraPages").then((m) => ({ default: m.CatalogPage })));
const ChatPlaceholderPage = lazy(() => import("@/pages/ops/ExtraPages").then((m) => ({ default: m.ChatPlaceholderPage })));
const InterventionReportPage = lazy(() => import("@/pages/ops/ExtraPages").then((m) => ({ default: m.InterventionReportPage })));
const SettingsPage = lazy(() => import("@/pages/ops/ExtraPages").then((m) => ({ default: m.SettingsPage })));
const LeadsPage = lazy(() => import("@/pages/leads/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const LeadDetailPage = lazy(() => import("@/pages/leads/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage })));
const QuoteRequestsPage = lazy(() => import("@/pages/quote-requests/QuoteRequestsPage").then((m) => ({ default: m.QuoteRequestsPage })));
const QuoteRequestDetailPage = lazy(() => import("@/pages/quote-requests/QuoteRequestDetailPage").then((m) => ({ default: m.QuoteRequestDetailPage })));
const ClientsPage = lazy(() => import("@/pages/clients/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const ClientCreatePage = lazy(() => import("@/pages/clients/ClientCreatePage").then((m) => ({ default: m.ClientCreatePage })));
const ClientDetailPage = lazy(() => import("@/pages/clients/ClientDetailPage").then((m) => ({ default: m.ClientDetailPage })));
const InterventionsPage = lazy(() => import("@/pages/interventions/InterventionsPage").then((m) => ({ default: m.InterventionsPage })));
const InterventionCreatePage = lazy(() => import("@/pages/interventions/InterventionCreatePage").then((m) => ({ default: m.InterventionCreatePage })));
const InterventionDetailPage = lazy(() => import("@/pages/interventions/InterventionDetailPage").then((m) => ({ default: m.InterventionDetailPage })));
const QuotesPage = lazy(() => import("@/pages/quotes/QuotesPage").then((m) => ({ default: m.QuotesPage })));
const QuoteCreatePage = lazy(() => import("@/pages/quotes/QuoteCreatePage").then((m) => ({ default: m.QuoteCreatePage })));
const QuoteDetailPage = lazy(() => import("@/pages/quotes/QuoteDetailPage").then((m) => ({ default: m.QuoteDetailPage })));
const InvoicesPage = lazy(() => import("@/pages/invoices/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceCreatePage = lazy(() => import("@/pages/invoices/InvoiceCreatePage").then((m) => ({ default: m.InvoiceCreatePage })));
const InvoiceDetailPage = lazy(() => import("@/pages/invoices/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage })));
const PaymentsPage = lazy(() => import("@/pages/payments/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const PaymentCreatePage = lazy(() => import("@/pages/payments/PaymentsPage").then((m) => ({ default: m.PaymentCreatePage })));
const ProvidersPage = lazy(() => import("@/pages/providers/ProvidersPage").then((m) => ({ default: m.ProvidersPage })));
const DemoApp = lazy(() => import("@/demo/DemoApp").then((m) => ({ default: m.DemoApp })));
import { isDemoMode } from "@/lib/demo/mode";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Le prestataire n’a pas de tableau de bord commercial : il arrive sur ses interventions. */
function HomePage() {
  const { role } = useAuth();
  return role === "prestataire" ? <Navigate to="/interventions" replace /> : <DashboardPage />;
}

export default function App() {
  if (isDemoMode()) {
    return (
      <Suspense fallback={<LoadingState />}>
        <DemoApp />
      </Suspense>
    );
  }

  if (!getSupabaseConfigStatus().configured) {
    return <SetupPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState className="min-h-screen" />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/definir-mot-de-passe" element={<SetPasswordPage />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route element={<ProtectedRoute permission="dashboard:view" />}>
                  <Route index element={<HomePage />} />
                </Route>

                <Route element={<ProtectedRoute permission="leads:read" />}>
                  <Route path="demandes-devis" element={<QuoteRequestsPage />} />
                  <Route path="demandes-devis/:id" element={<QuoteRequestDetailPage />} />
                  <Route path="prospects" element={<LeadsPage />} />
                  <Route path="prospects/:id" element={<LeadDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="stats:view" />}>
                  <Route path="commerciaux" element={<CommercialsPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="clients:write" />}>
                  <Route path="clients/nouveau" element={<ClientCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="clients:read" />}>
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/:id" element={<ClientDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="interventions:create" />}>
                  <Route path="interventions/nouvelle" element={<InterventionCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="interventions:read" />}>
                  <Route path="interventions" element={<InterventionsPage />} />
                  <Route path="interventions/:id" element={<InterventionDetailPage />} />
                  <Route path="interventions/:id/report" element={<InterventionReportPage />} />
                  <Route path="agenda" element={<AgendaPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="quotes:write" />}>
                  <Route path="devis/nouveau" element={<QuoteCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="quotes:read" />}>
                  <Route path="devis" element={<QuotesPage />} />
                  <Route path="devis/:id" element={<QuoteDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="invoices:write" />}>
                  <Route path="factures/nouvelle" element={<InvoiceCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="invoices:read" />}>
                  <Route path="factures" element={<InvoicesPage />} />
                  <Route path="factures/:id" element={<InvoiceDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="payments:write" />}>
                  <Route path="paiements/nouveau" element={<PaymentCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="payments:read" />}>
                  <Route path="paiements" element={<PaymentsPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="providers:read" />}>
                  <Route path="prestataires" element={<ProvidersPage />} />
                </Route>
                <Route element={<ProtectedRoute permission="quotes:read" />}>
                  <Route path="produits" element={<CatalogPage />} />
                </Route>
                <Route element={<ProtectedRoute permission="dashboard:view" />}>
                  <Route path="chat" element={<ChatPlaceholderPage />} />
                </Route>
                <Route path="securite" element={<AccountSecurityPage />} />
                <Route element={<ProtectedRoute permission="users:manage" />}>
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
