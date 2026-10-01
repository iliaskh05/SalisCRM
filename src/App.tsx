import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { getSupabaseConfigStatus } from "@/lib/supabase/client";
import { SetupPage } from "@/features/app/SetupPage";
import { LoginPage } from "@/features/auth/LoginPage";
const SetPasswordPage = lazy(() => import("@/features/auth/SetPasswordPage").then((m) => ({ default: m.SetPasswordPage })));
const AccountSecurityPage = lazy(() => import("@/features/auth/AccountSecurityPage").then((m) => ({ default: m.AccountSecurityPage })));
const NotFoundPage = lazy(() => import("@/features/app/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazy(() => import("@/features/auth/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })));
const CommercialsPage = lazy(() => import("@/features/commercials/CommercialsPage").then((m) => ({ default: m.CommercialsPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AgendaPage = lazy(() => import("@/features/agenda/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const CatalogPage = lazy(() => import("@/features/catalog/CatalogPage").then((m) => ({ default: m.CatalogPage })));
const ChatPlaceholderPage = lazy(() => import("@/features/chat/ChatPlaceholderPage").then((m) => ({ default: m.ChatPlaceholderPage })));
const InterventionReportPage = lazy(() => import("@/features/interventions/InterventionReportPage").then((m) => ({ default: m.InterventionReportPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const LeadsPage = lazy(() => import("@/features/leads/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const LeadDetailPage = lazy(() => import("@/features/leads/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage })));
const QuoteRequestsPage = lazy(() => import("@/features/quote-requests/QuoteRequestsPage").then((m) => ({ default: m.QuoteRequestsPage })));
const QuoteRequestDetailPage = lazy(() => import("@/features/quote-requests/QuoteRequestDetailPage").then((m) => ({ default: m.QuoteRequestDetailPage })));
const ClientsPage = lazy(() => import("@/features/clients/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const ClientCreatePage = lazy(() => import("@/features/clients/ClientCreatePage").then((m) => ({ default: m.ClientCreatePage })));
const ClientDetailPage = lazy(() => import("@/features/clients/ClientDetailPage").then((m) => ({ default: m.ClientDetailPage })));
const InterventionsPage = lazy(() => import("@/features/interventions/InterventionsPage").then((m) => ({ default: m.InterventionsPage })));
const InterventionCreatePage = lazy(() => import("@/features/interventions/InterventionCreatePage").then((m) => ({ default: m.InterventionCreatePage })));
const InterventionDetailPage = lazy(() => import("@/features/interventions/InterventionDetailPage").then((m) => ({ default: m.InterventionDetailPage })));
const QuotesPage = lazy(() => import("@/features/quotes/QuotesPage").then((m) => ({ default: m.QuotesPage })));
const QuoteCreatePage = lazy(() => import("@/features/quotes/QuoteCreatePage").then((m) => ({ default: m.QuoteCreatePage })));
const QuoteDetailPage = lazy(() => import("@/features/quotes/QuoteDetailPage").then((m) => ({ default: m.QuoteDetailPage })));
const InvoicesPage = lazy(() => import("@/features/invoices/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceCreatePage = lazy(() => import("@/features/invoices/InvoiceCreatePage").then((m) => ({ default: m.InvoiceCreatePage })));
const InvoiceDetailPage = lazy(() => import("@/features/invoices/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage })));
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const PaymentCreatePage = lazy(() => import("@/features/payments/PaymentsPage").then((m) => ({ default: m.PaymentCreatePage })));
const ProvidersPage = lazy(() => import("@/features/providers/ProvidersPage").then((m) => ({ default: m.ProvidersPage })));
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
