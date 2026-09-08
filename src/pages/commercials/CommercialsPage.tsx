import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { CommercialClosesView } from "@/components/commercials/CommercialClosesView";
import { supabase } from "@/lib/supabase/client";
import { aggregateCommercialStats, isClosedQuote } from "@/lib/quotes/commercial-stats";

async function fetchCommercialCloses() {
  const [quotesRes, staffRes, clientsRes] = await Promise.all([
    supabase.from("quotes").select("id, reference, status, total_ttc, created_by, client_id"),
    supabase.from("staff_profiles").select("user_id, display_name, role").in("role", ["admin", "commercial"]),
    supabase.from("clients").select("id, company_name"),
  ]);
  if (quotesRes.error) throw quotesRes.error;

  const staff = (staffRes.data ?? []).map((s) => ({
    id: s.user_id,
    name: s.display_name?.trim() || "Commercial",
    role: s.role,
  }));
  const commercials = staff.filter((s) => s.role === "commercial");
  const people = (commercials.length > 0 ? commercials : staff).map((s) => ({ id: s.id, name: s.name }));
  const quotes = quotesRes.data ?? [];
  const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.company_name]));

  const rows = aggregateCommercialStats(
    people,
    quotes.map((q) => ({
      commercialId: q.created_by,
      status: q.status,
      amountTtc: Number(q.total_ttc ?? 0),
    })),
  );
  const deals = quotes
    .filter((q) => isClosedQuote(q.status))
    .map((q) => ({
      id: q.id,
      commercialId: q.created_by ?? "unassigned",
      reference: q.reference ?? "Sans réf.",
      clientName: q.client_id ? clientMap.get(q.client_id) ?? "—" : "—",
      amountTtc: Number(q.total_ttc ?? 0),
    }));

  return { rows, deals };
}

export function CommercialsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["commercial-closes"],
    queryFn: fetchCommercialCloses,
  });

  if (isLoading) return <LoadingState label="Chargement des commerciaux…" />;
  if (error || !data) {
    return <EmptyState title="Impossible de charger les commerciaux" description={String(error)} />;
  }

  return (
    <div>
      <PageHeader
        title="Commerciaux"
        description="Affaires abouties (closes) par personne — Wael, Alix et le reste de l’équipe."
      />
      <CommercialClosesView rows={data.rows} deals={data.deals} />
    </div>
  );
}
