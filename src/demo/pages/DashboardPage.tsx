import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, CircleDollarSign, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invoiceBalance, quoteTotals, useDemoStore } from "@/lib/demo/store";
import { REQUEST_STATUS_LABELS } from "@/lib/quote-requests/status";
import { DEMO_TODAY } from "@/lib/demo/fixtures";
import { formatCurrency } from "@/lib/format";
import { aggregateCommercialStats } from "@/lib/quotes/commercial-stats";
import { CommercialPerformance } from "@/components/dashboard/CommercialPerformance";
import { InterventionBadge, InvoiceBadge, Kpi, PageTitle, QuoteBadge } from "@/demo/ui";

export function DemoDashboardPage() {
  const { state, isProvider, currentUser } = useDemoStore();
  const navigate = useNavigate();
  if (isProvider) return <ProviderDashboard />;

  const monthQuotes = state.quotes.filter((q) => q.issuedAt.startsWith("2026-09"));
  const accepted = state.quotes.filter((q) =>
    ["accepted", "converted_intervention", "converted_invoice"].includes(q.status),
  );
  const pending = state.quotes.filter((q) => ["sent", "viewed", "pending", "ready"].includes(q.status));
  const monthValue = monthQuotes.reduce((s, q) => s + quoteTotals(state, q.id).totalTtc, 0);
  const collected = state.payments.reduce((s, p) => s + p.amount, 0);
  const invoiced = state.invoices.reduce((s, inv) => s + invoiceBalance(state, inv.id).totalTtc, 0);
  const outstanding = state.invoices.reduce((s, inv) => s + invoiceBalance(state, inv.id).remaining, 0);
  const overdue = state.invoices.filter((inv) => invoiceBalance(state, inv.id).overdue).length;
  const upcoming = state.interventions.filter((i) => i.date >= DEMO_TODAY && !["cancelled", "closed"].includes(i.status));
  const completed = state.interventions.filter((i) => ["completed", "report_validated", "invoiced", "closed"].includes(i.status));
  const conversion = state.quotes.length ? Math.round((accepted.length / state.quotes.length) * 100) : 0;
  const productCost = state.products.reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const providerCost = completed.reduce((s, i) => {
    const pr = state.providers.find((p) => p.id === i.providerId);
    return s + (pr?.costRate ?? 0);
  }, 0);
  const margin = invoiced - providerCost - productCost;
  const commercialRows = aggregateCommercialStats(
    state.users
      .filter((u) => u.status === "active" && u.role === "commercial")
      .map((u) => ({ id: u.id, name: u.name })),
    state.quotes.map((q) => ({
      commercialId: q.commercialId,
      status: q.status,
      amountTtc: quoteTotals(state, q.id).totalTtc,
    })),
  );

  return (
    <>
      <PageTitle eyebrow="Pilotage" title={`Bonjour ${currentUser?.name.split(" ")[0] ?? ""}.`}>
        <Button variant="accent" onClick={() => navigate("/interventions/nouvelle")}>
          <CalendarDays className="size-4" />
          Planifier une intervention
        </Button>
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="CA encaissé" value={formatCurrency(collected)} detail="Paiements enregistrés" icon={CircleDollarSign} />
        <Kpi label="Facturé" value={formatCurrency(invoiced)} detail={`${overdue} facture(s) en retard`} icon={Wallet} tone="amber" />
        <Kpi label="Reste dû" value={formatCurrency(outstanding)} detail="Encours clients" icon={Wallet} tone="rose" />
        <Kpi label="Marge estimée" value={formatCurrency(margin)} detail="Ventes − prestataires − produits" icon={ArrowUpRight} />
        <Kpi label="Devis du mois" value={String(monthQuotes.length)} detail={formatCurrency(monthValue)} icon={FileText} />
        <Kpi label="Devis en attente" value={String(pending.length)} detail={`${accepted.length} acceptés`} icon={FileText} tone="navy" />
        <Kpi label="Taux de conversion" value={`${conversion} %`} detail="Devis acceptés / émis" icon={ArrowUpRight} />
        <Kpi label="Affaires abouties" value={String(accepted.length)} detail="Devis acceptés par le commercial" icon={FileText} tone="navy" />
        <Kpi label="Interventions à venir" value={String(upcoming.length)} detail={`${completed.length} terminées`} icon={CalendarDays} tone="navy" />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>À traiter</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Demandes issues du site commercial.</p>
            </div>
            <Link className="text-xs font-semibold text-teal-700" to="/demandes-devis">
              Demandes site
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {state.leads.filter((l) => l.channel === "website" && !l.convertedClientId).slice(0, 5).map((lead) => (
              <Link key={lead.id} to={`/demandes-devis/${lead.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50">
                <div className="flex size-9 items-center justify-center rounded-xl bg-teal-50 font-semibold text-teal-700">
                  {lead.company.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{lead.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{lead.city} · {lead.note}</p>
                </div>
                <span className="text-xs text-muted-foreground">{REQUEST_STATUS_LABELS[lead.status]}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Interventions prochaines</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {upcoming.slice(0, 4).map((item) => {
              const client = state.clients.find((c) => c.id === item.clientId);
              return (
                <Link key={item.id} to={`/interventions/${item.id}`} className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <span className="text-xs font-bold">{item.date.slice(8, 10)}</span>
                    <span className="text-[9px]">SEP</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{client?.name}</p>
                    <p className="text-xs text-muted-foreground">{item.service}</p>
                    <p className="mt-1 text-xs font-medium text-teal-700">{item.startTime} · {item.city}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <CommercialPerformance rows={commercialRows} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Devis en cours</CardTitle>
            <Link className="text-xs font-semibold text-teal-700" to="/devis">Tous les devis</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.concat(state.quotes.filter((q) => q.status === "draft")).slice(0, 5).map((q) => (
              <Link key={q.id} to={`/devis/${q.id}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{q.reference}</p>
                  <p className="text-xs text-muted-foreground">{state.clients.find((c) => c.id === q.clientId)?.name}</p>
                </div>
                <QuoteBadge status={q.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Factures à relancer</CardTitle>
            <Link className="text-xs font-semibold text-teal-700" to="/factures">Finance</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.invoices.filter((i) => invoiceBalance(state, i.id).remaining > 0).map((inv) => {
              const bal = invoiceBalance(state, inv.id);
              return (
                <Link key={inv.id} to={`/factures/${inv.id}`} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{inv.number}</p>
                    <p className="text-xs text-muted-foreground">{state.clients.find((c) => c.id === inv.clientId)?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(bal.remaining)}</p>
                    <InvoiceBadge status={bal.status} />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ProviderDashboard() {
  const { state, currentUser } = useDemoStore();
  const provider = state.providers.find((p) => p.userId === currentUser?.id);
  const mine = state.interventions.filter((i) => i.providerId === provider?.id && i.status !== "cancelled");
  const today = mine.filter((i) => i.date === DEMO_TODAY);
  const next = mine.filter((i) => i.date >= DEMO_TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
  const reports = mine.filter((i) => ["completed", "report_pending"].includes(i.status));
  const missingPhotos = mine.filter((i) => !state.photos.some((p) => p.interventionId === i.id && p.kind === "before"));
  const unread = state.messages.filter((m) => currentUser && !m.readBy.includes(currentUser.id)).length;

  return (
    <>
      <PageTitle eyebrow="Terrain" title="Mes interventions" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Aujourd’hui" value={String(today.length)} detail="Missions du jour" icon={CalendarDays} />
        <Kpi label="Prochaine" value={next ? next.startTime : "—"} detail={next ? state.clients.find((c) => c.id === next.clientId)?.name ?? "" : "Aucune"} icon={CalendarDays} tone="navy" />
        <Kpi label="Rapports à faire" value={String(reports.length)} detail="À compléter" icon={FileText} tone="amber" />
        <Kpi label="Messages" value={String(unread)} detail="Non lus" icon={Wallet} />
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Aujourd’hui</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(today.length ? today : mine.slice(0, 3)).map((i) => (
            <Link key={i.id} to={`/interventions/${i.id}`} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-semibold">{state.clients.find((c) => c.id === i.clientId)?.name}</p>
                <p className="text-xs text-muted-foreground">{i.address}</p>
              </div>
              <InterventionBadge status={i.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
      {missingPhotos.length > 0 ? (
        <p className="mt-4 text-sm text-amber-700">{missingPhotos.length} intervention(s) sans photos avant.</p>
      ) : null}
    </>
  );
}

