import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { getSupabaseConfigStatus } from "@/lib/supabase/client";
import { SetupPage } from "@/pages/SetupPage";
import { LoginPage } from "@/pages/LoginPage";
import { UnauthorizedPage } from "@/pages/UnauthorizedPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LeadsPage } from "@/pages/leads/LeadsPage";
import { LeadDetailPage } from "@/pages/leads/LeadDetailPage";
import { ClientsPage } from "@/pages/clients/ClientsPage";
import { ClientCreatePage } from "@/pages/clients/ClientCreatePage";
import { ClientDetailPage } from "@/pages/clients/ClientDetailPage";
import { InterventionsPage } from "@/pages/interventions/InterventionsPage";
import { InterventionCreatePage } from "@/pages/interventions/InterventionCreatePage";
import { InterventionDetailPage } from "@/pages/interventions/InterventionDetailPage";
import { QuotesPage } from "@/pages/quotes/QuotesPage";
import { QuoteCreatePage } from "@/pages/quotes/QuoteCreatePage";
import { QuoteDetailPage } from "@/pages/quotes/QuoteDetailPage";
import { InvoicesPage } from "@/pages/invoices/InvoicesPage";
import { InvoiceCreatePage } from "@/pages/invoices/InvoiceCreatePage";
import { InvoiceDetailPage } from "@/pages/invoices/InvoiceDetailPage";
import { PaymentsPage, PaymentCreatePage } from "@/pages/payments/PaymentsPage";
import { ProvidersPage } from "@/pages/providers/ProvidersPage";
import { DemoApp } from "@/demo/DemoApp";
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

export default function App() {
  if (isDemoMode()) {
    return <DemoApp />;
  }

  if (!getSupabaseConfigStatus().configured) {
    return <SetupPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route element={<ProtectedRoute permission="dashboard:view" />}>
                  <Route index element={<DashboardPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="leads:read" />}>
                  <Route path="prospects" element={<LeadsPage />} />
                  <Route path="prospects/:id" element={<LeadDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="clients:write" />}>
                  <Route path="clients/nouveau" element={<ClientCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="clients:read" />}>
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/:id" element={<ClientDetailPage />} />
                </Route>

                <Route element={<ProtectedRoute permission="interventions:write" />}>
                  <Route path="interventions/nouvelle" element={<InterventionCreatePage />} />
                </Route>
                <Route element={<ProtectedRoute permission="interventions:read" />}>
                  <Route path="interventions" element={<InterventionsPage />} />
                  <Route path="interventions/:id" element={<InterventionDetailPage />} />
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
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
