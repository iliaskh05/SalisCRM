import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { DemoStoreProvider, useDemoStore } from "@/lib/demo/store";
import { DemoShell } from "@/demo/DemoShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DemoLoginPage, DemoRegisterPage } from "@/demo/pages/AuthPages";
import { DemoCommercialsPage } from "@/demo/pages/CommercialsPage";
import { DemoDashboardPage } from "@/demo/pages/DashboardPage";
import { DemoLeadDetailPage, DemoLeadsPage } from "@/demo/pages/LeadsPages";
import { DemoQuoteRequestDetailPage, DemoQuoteRequestsPage } from "@/demo/pages/QuoteRequestsPages";
import { DemoClientCreatePage, DemoClientDetailPage, DemoClientsPage } from "@/demo/pages/ClientsPages";
import { DemoQuoteCreatePage, DemoQuoteDetailPage, DemoQuotesPage } from "@/demo/pages/QuotesPages";
import { DemoInterventionCreatePage, DemoInterventionDetailPage, DemoInterventionsPage, DemoReportPage } from "@/demo/pages/InterventionsPages";
import { DemoAgendaPage } from "@/demo/pages/AgendaPage";
import { DemoInvoiceCreatePage, DemoInvoiceDetailPage, DemoInvoicesPage, DemoPaymentCreatePage, DemoPaymentsPage } from "@/demo/pages/FinancePages";
import { DemoChatPage } from "@/demo/pages/ChatPage";
import { DemoProductsPage, DemoProvidersPage, DemoSettingsPage } from "@/demo/pages/MiscPages";

function Guard({ children, managementOnly }: { children?: React.ReactNode; managementOnly?: boolean }) {
  const { currentUser, isProvider } = useDemoStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (managementOnly && isProvider) return <Navigate to="/unauthorized" replace />;
  return children ? <>{children}</> : <Outlet />;
}

function Unauthorized() {
  return (
    <div className="p-10 text-center">
      <BrandLogo size="md" align="center" className="mb-5" />
      <h1 className="font-serif text-2xl">Accès non autorisé</h1>
      <p className="mt-2 text-sm text-muted-foreground">Cette section est réservée à la direction.</p>
    </div>
  );
}

export function DemoApp() {
  return (
    <DemoStoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<DemoLoginPage />} />
          <Route path="/register" element={<DemoRegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<Guard />}>
            <Route element={<DemoShell />}>
              <Route index element={<DemoDashboardPage />} />
              <Route path="prospects" element={<DemoLeadsPage />} />
              <Route path="prospects/:id" element={<DemoLeadDetailPage />} />
              <Route path="demandes-devis" element={<Guard managementOnly><DemoQuoteRequestsPage /></Guard>} />
              <Route path="demandes-devis/:id" element={<Guard managementOnly><DemoQuoteRequestDetailPage /></Guard>} />
              <Route path="commerciaux" element={<Guard managementOnly><DemoCommercialsPage /></Guard>} />
              <Route path="clients" element={<Guard managementOnly><DemoClientsPage /></Guard>} />
              <Route path="clients/nouveau" element={<Guard managementOnly><DemoClientCreatePage /></Guard>} />
              <Route path="clients/:id" element={<DemoClientDetailPage />} />
              <Route path="devis" element={<Guard managementOnly><DemoQuotesPage /></Guard>} />
              <Route path="devis/nouveau" element={<Guard managementOnly><DemoQuoteCreatePage /></Guard>} />
              <Route path="devis/:id" element={<Guard managementOnly><DemoQuoteDetailPage /></Guard>} />
              <Route path="interventions" element={<DemoInterventionsPage />} />
              <Route path="interventions/nouvelle" element={<Guard managementOnly><DemoInterventionCreatePage /></Guard>} />
              <Route path="interventions/:id" element={<DemoInterventionDetailPage />} />
              <Route path="interventions/:id/report" element={<DemoReportPage />} />
              <Route path="agenda" element={<DemoAgendaPage />} />
              <Route path="factures" element={<Guard managementOnly><DemoInvoicesPage /></Guard>} />
              <Route path="factures/nouvelle" element={<Guard managementOnly><DemoInvoiceCreatePage /></Guard>} />
              <Route path="factures/:id" element={<Guard managementOnly><DemoInvoiceDetailPage /></Guard>} />
              <Route path="paiements" element={<Guard managementOnly><DemoPaymentsPage /></Guard>} />
              <Route path="paiements/nouveau" element={<Guard managementOnly><DemoPaymentCreatePage /></Guard>} />
              <Route path="prestataires" element={<Guard managementOnly><DemoProvidersPage /></Guard>} />
              <Route path="produits" element={<Guard managementOnly><DemoProductsPage /></Guard>} />
              <Route path="chat" element={<DemoChatPage />} />
              <Route path="settings" element={<Guard managementOnly><DemoSettingsPage /></Guard>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-right" closeButton />
      </BrowserRouter>
    </DemoStoreProvider>
  );
}
