import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FilePlus2, Receipt, Wallet, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ClientStatusBadge,
  InterventionStatusBadge,
  InvoiceStatusBadge,
  QuoteStatusBadge,
} from "@/components/ui/status-badge";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { ClientPrivacyActions } from "@/features/clients/ClientPrivacyActions";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { isAdmin } from "@/lib/auth/permissions";
import { fetchClientBundle, visibleTabs } from "./detail/data";
import { GeneralTab } from "./detail/GeneralTab";
import { InstallationTab } from "./detail/InstallationTab";
import { ListTab } from "./detail/ListTab";
import { PhotosTab } from "./detail/PhotosTab";
import { DocumentsTab } from "./detail/DocumentsTab";

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role, hasPermission } = useAuth();
  const tabs = visibleTabs(role);
  const requestedTab = params.get("tab") ?? "general";
  // Onglet demandé dans l'URL mais non autorisé pour ce rôle : retour à la vue générale
  const tab = tabs.some((t) => t.id === requestedTab) ? requestedTab : "general";

  const { data, isLoading, error } = useQuery({
    queryKey: ["client", id, role],
    queryFn: () => fetchClientBundle(id, role),
    enabled: Boolean(id),
  });

  const setTab = (next: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p);
  };

  if (isLoading) return <LoadingState />;
  if (error || !data) return <EmptyState title="Client introuvable" description={String(error ?? "")} />;

  const { client } = data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/clients")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={client.company_name}
        description={`${client.reference ?? client.id.slice(0, 8)} · ${client.city || "Sans ville"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ClientStatusBadge status={client.status} />
            <RoleGate permission="quotes:write">
              <Button variant="outline" size="sm" onClick={() => navigate(`/devis/nouveau?client=${client.id}`)}>
                <FilePlus2 className="size-3.5" />
                Devis
              </Button>
            </RoleGate>
            <RoleGate permission="interventions:create">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/interventions/nouvelle?client=${client.id}`)}
              >
                <Wrench className="size-3.5" />
                Intervention
              </Button>
            </RoleGate>
            <RoleGate permission="invoices:write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/factures/nouvelle?client=${client.id}`)}
              >
                <Receipt className="size-3.5" />
                Facture
              </Button>
            </RoleGate>
            <RoleGate permission="payments:write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/paiements/nouveau?client=${client.id}`)}
              >
                <Wallet className="size-3.5" />
                Paiement
              </Button>
            </RoleGate>
            <RoleGate permission="users:manage">
              <ClientPrivacyActions clientId={client.id} reference={client.reference} hasInvoices={data.invoices.length > 0} />
            </RoleGate>
          </div>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

      {tab === "general" && (
        <GeneralTab
          client={client}
          financial={data.financial}
          showFinancial={hasPermission("finances:view")}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["client", id] });
            await qc.invalidateQueries({ queryKey: ["clients"] });
            await qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}
      {tab === "installation" && (
        <InstallationTab
          clientId={client.id}
          installations={data.installations}
          onSaved={() => qc.invalidateQueries({ queryKey: ["client", id] })}
        />
      )}
      {tab === "interventions" && (
        <ListTab
          empty="Aucune intervention"
          items={data.interventions.map((i) => ({
            id: i.id,
            href: `/interventions/${i.id}`,
            title: i.reference ?? i.service_type ?? "Intervention",
            subtitle: formatDate(i.scheduled_date),
            badge: <InterventionStatusBadge status={i.status} />,
          }))}
        />
      )}
      {tab === "photos" && (
        <PhotosTab photos={data.photos} canDelete={isAdmin(role)} onChanged={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      )}
      {tab === "devis" && (
        <ListTab
          empty="Aucun devis"
          items={data.quotes.map((q) => ({
            id: q.id,
            href: `/devis/${q.id}`,
            title: q.reference ?? "Devis",
            subtitle: formatCurrency(q.total_ttc),
            badge: <QuoteStatusBadge status={q.status} />,
          }))}
        />
      )}
      {tab === "factures" && (
        <ListTab
          empty="Aucune facture"
          items={data.invoices.map((inv) => ({
            id: inv.invoice_id!,
            href: `/factures/${inv.invoice_id}`,
            title: inv.number ?? "Facture",
            subtitle: `TTC ${formatCurrency(inv.total_ttc)} · Dû ${formatCurrency(inv.amount_due)}`,
            badge: inv.status ? <InvoiceStatusBadge status={inv.status} /> : null,
          }))}
        />
      )}
      {tab === "paiements" && (
        <ListTab
          empty="Aucun paiement"
          items={data.payments.map((p) => ({
            id: p.id,
            href: `/paiements`,
            title: formatCurrency(p.amount),
            subtitle: `${formatDate(p.paid_at)} · ${p.method}`,
            badge: null,
          }))}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          clientId={client.id}
          documents={data.documents}
          userId={user?.id}
          onChanged={() => qc.invalidateQueries({ queryKey: ["client", id] })}
        />
      )}
      {tab === "historique" && (
        <Card>
          <CardContent className="p-0">
            {data.activities.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Aucune activité" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.activities.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[a.activity_type]}
                        {a.description ? ` — ${a.description}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
