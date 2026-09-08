import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge, QuoteStatusBadge, InterventionStatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/lib/supabase/client";
import { formatCurrency, formatDate, todayISO, startOfMonthISO, endOfMonthISO } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { aggregateCommercialStats } from "@/lib/quotes/commercial-stats";
import { CommercialPerformance } from "@/components/dashboard/CommercialPerformance";
import type { Tables } from "@/lib/supabase/types";

type Kpi = { label: string; value: string; icon: typeof Users; to?: string };

async function fetchDashboard() {
  const today = todayISO();
  const monthStart = startOfMonthISO();
  const monthEnd = endOfMonthISO();

  const [
    clientsRes,
    leadsNewRes,
    quotesPendingRes,
    paymentsMonthRes,
    balancesRes,
    interventionsUpcomingRes,
    unpaidRes,
    actionsLeadsRes,
    actionsClientsRes,
    quotesRelanceRes,
    activitiesRes,
    quotesAllRes,
    staffRes,
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent"]),
    supabase
      .from("payments")
      .select("amount")
      .gte("paid_at", monthStart)
      .lte("paid_at", monthEnd),
    supabase.from("invoice_balances").select("total_ttc, amount_paid, amount_due, status"),
    supabase
      .from("interventions")
      .select("id, reference, scheduled_date, time_slot, status, service_type, client_id")
      .in("status", ["to_plan", "planned", "in_progress"])
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(8),
    supabase
      .from("invoice_balances")
      .select("invoice_id, number, amount_due, status, due_at, client_id")
      .gt("amount_due", 0)
      .neq("status", "cancelled")
      .order("due_at", { ascending: true })
      .limit(8),
    supabase
      .from("leads")
      .select("id, company_name, contact_name, next_action, next_action_date, status")
      .not("next_action_date", "is", null)
      .lte("next_action_date", today)
      .neq("status", "won")
      .neq("status", "lost")
      .order("next_action_date", { ascending: true })
      .limit(10),
    supabase
      .from("clients")
      .select("id, company_name, next_action, next_action_date, status")
      .not("next_action_date", "is", null)
      .lte("next_action_date", today)
      .neq("status", "archived")
      .order("next_action_date", { ascending: true })
      .limit(10),
    supabase
      .from("quotes")
      .select("id, reference, status, total_ttc, issued_at, client_id")
      .eq("status", "sent")
      .order("issued_at", { ascending: true })
      .limit(8),
    supabase
      .from("activities")
      .select("id, activity_type, title, description, created_at, client_id, lead_id")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("quotes").select("id, status, total_ttc, created_by"),
    supabase.from("staff_profiles").select("user_id, display_name, role").in("role", ["admin", "commercial"]),
  ]);

  const clientIds = [
    ...new Set(
      [
        ...(interventionsUpcomingRes.data ?? []).map((i) => i.client_id),
        ...(unpaidRes.data ?? []).map((i) => i.client_id),
        ...(quotesRelanceRes.data ?? []).map((q) => q.client_id),
      ].filter(Boolean) as string[],
    ),
  ];

  const clientsMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, company_name")
      .in("id", clientIds);
    for (const c of clients ?? []) clientsMap[c.id] = c.company_name;
  }

  const monthCa = (paymentsMonthRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const balances = balancesRes.data ?? [];
  const invoiced = balances.reduce((s, b) => s + Number(b.total_ttc ?? 0), 0);
  const collected = balances.reduce((s, b) => s + Number(b.amount_paid ?? 0), 0);
  const due = balances.reduce((s, b) => s + Number(b.amount_due ?? 0), 0);
  const overdueCount = balances.filter((b) => b.status === "overdue").length;
  const quotesAll = quotesAllRes.data ?? [];
  const closedQuotes = quotesAll.filter((q) => q.status === "accepted");
  const staffPeople = (staffRes.data ?? []).map((s) => ({
    id: s.user_id,
    name: s.display_name?.trim() || "Commercial",
    role: s.role,
  }));
  const commercials = staffPeople.filter((s) => s.role === "commercial");
  const commercialRows = aggregateCommercialStats(
    (commercials.length > 0 ? commercials : staffPeople.filter((s) => s.role !== "prestataire")).map((s) => ({
      id: s.id,
      name: s.name,
    })),
    quotesAll.map((q) => ({
      commercialId: q.created_by,
      status: q.status,
      amountTtc: Number(q.total_ttc ?? 0),
    })),
  );

  return {
    kpis: {
      activeClients: clientsRes.count ?? 0,
      newLeads: leadsNewRes.count ?? 0,
      quotesPending: quotesPendingRes.count ?? 0,
      monthCa,
      invoiced,
      collected,
      due,
      upcomingInterventions: interventionsUpcomingRes.data?.length ?? 0,
      overdueInvoices: overdueCount,
      closedDeals: closedQuotes.length,
    },
    commercialRows,
    interventions: interventionsUpcomingRes.data ?? [],
    unpaid: unpaidRes.data ?? [],
    actionsLeads: actionsLeadsRes.data ?? [],
    actionsClients: actionsClientsRes.data ?? [],
    quotesRelance: quotesRelanceRes.data ?? [],
    activities: (activitiesRes.data ?? []) as Tables<"activities">[],
    clientsMap,
    errors: [
      clientsRes.error,
      leadsNewRes.error,
      quotesPendingRes.error,
      paymentsMonthRes.error,
      balancesRes.error,
      interventionsUpcomingRes.error,
      unpaidRes.error,
      actionsLeadsRes.error,
      actionsClientsRes.error,
      quotesRelanceRes.error,
      activitiesRes.error,
      quotesAllRes.error,
      staffRes.error,
    ]
      .filter(Boolean)
      .map((e) => e!.message),
  };
}

function KpiCard({ item }: { item: Kpi }) {
  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{item.value}</p>
        </div>
        <div className="rounded-lg bg-accent/10 p-2 text-accent">
          <item.icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
  return item.to ? <Link to={item.to}>{content}</Link> : content;
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) return <LoadingState label="Chargement du tableau de bord…" />;
  if (error || !data) {
    return <EmptyState title="Impossible de charger le tableau de bord" description={String(error)} />;
  }

  const k = data.kpis;
  const kpiItems: Kpi[] = [
    { label: "Clients actifs", value: String(k.activeClients), icon: Building2, to: "/clients" },
    { label: "Nouvelles demandes", value: String(k.newLeads), icon: Users, to: "/demandes-devis" },
    { label: "Devis en cours", value: String(k.quotesPending), icon: FileText, to: "/devis" },
    { label: "CA du mois", value: formatCurrency(k.monthCa), icon: TrendingUp, to: "/paiements" },
    { label: "Facturé", value: formatCurrency(k.invoiced), icon: Receipt, to: "/factures" },
    { label: "Encaissé", value: formatCurrency(k.collected), icon: Wallet, to: "/paiements" },
    { label: "Reste dû", value: formatCurrency(k.due), icon: AlertTriangle, to: "/factures" },
    {
      label: "Interventions à venir",
      value: String(k.upcomingInterventions),
      icon: CalendarClock,
      to: "/interventions",
    },
    { label: "Affaires abouties", value: String(k.closedDeals), icon: TrendingUp, to: "/devis" },
  ];

  const todayActions = [
    ...data.actionsLeads.map((l) => ({
      key: `lead-${l.id}`,
      label: l.company_name || l.contact_name || "Prospect",
      action: l.next_action,
      date: l.next_action_date,
      href: `/prospects/${l.id}`,
      kind: "Prospect" as const,
    })),
    ...data.actionsClients.map((c) => ({
      key: `client-${c.id}`,
      label: c.company_name,
      action: c.next_action,
      date: c.next_action_date,
      href: `/clients/${c.id}`,
      kind: "Client" as const,
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue opérationnelle et financière — données en temps réel."
      />

      {data.errors.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Certaines requêtes ont échoué : {data.errors.join(" · ")}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      <div className="mt-6">
        <CommercialPerformance rows={data.commercialRows} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>À traiter aujourd&apos;hui</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {todayActions.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState title="Rien à traiter" description="Aucune relance échue pour aujourd'hui." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {todayActions.map((a) => (
                  <li key={a.key}>
                    <Link to={a.href} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground">{a.kind} · </span>
                          {a.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.action || "Relance"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(a.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interventions prochaines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {data.interventions.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState title="Aucune intervention planifiée" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.interventions.map((i) => {
                  return (
                    <li key={i.id}>
                      <Link
                        to={`/interventions/${i.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"
                      >
                        <div>
                          <p className="text-sm font-medium">{data.clientsMap[i.client_id] ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.reference ?? "Sans réf."} · {i.service_type ?? "Intervention"}
                            {i.time_slot ? ` · ${i.time_slot}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">{formatDate(i.scheduled_date)}</span>
                          <InterventionStatusBadge status={i.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devis à relancer</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.quotesRelance.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState title="Aucun devis envoyé en attente" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.quotesRelance.map((q) => {
                  return (
                    <li key={q.id}>
                      <Link
                        to={`/devis/${q.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"
                      >
                        <div>
                          <p className="text-sm font-medium">{data.clientsMap[q.client_id] ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.reference ?? "Sans réf."} · {formatCurrency(q.total_ttc)}
                          </p>
                        </div>
                        <QuoteStatusBadge status={q.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factures impayées</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.unpaid.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState title="Aucune facture impayée" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.unpaid.map((inv) => {
                  return (
                    <li key={inv.invoice_id}>
                      <Link
                        to={`/factures/${inv.invoice_id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {inv.client_id ? data.clientsMap[inv.client_id] ?? "—" : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inv.number ?? "Sans n°"} · dû {formatCurrency(inv.amount_due)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">{formatDate(inv.due_at)}</span>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.activities.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="Aucune activité" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.activities.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ACTIVITY_TYPE_LABELS[a.activity_type]}
                      {a.description ? ` — ${a.description}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.created_at, "dd/MM HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
