import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CommercialClosesView } from "@/components/commercials/CommercialClosesView";
import { quoteTotals, useDemoStore } from "@/lib/demo/store";
import { aggregateCommercialStats, isClosedQuote } from "@/lib/quotes/commercial-stats";
import { PageTitle } from "@/demo/ui";

export function DemoCommercialsPage() {
  const { state, isProvider } = useDemoStore();
  if (isProvider) return <EmptyState title="Réservé à la direction et aux commerciaux" />;

  const people = state.users
    .filter((u) => u.status === "active" && u.role === "commercial")
    .map((u) => ({ id: u.id, name: u.name }));
  const rows = aggregateCommercialStats(
    people,
    state.quotes.map((q) => ({
      commercialId: q.commercialId,
      status: q.status,
      amountTtc: quoteTotals(state, q.id).totalTtc,
    })),
  );
  const deals = state.quotes
    .filter((q) => isClosedQuote(q.status))
    .map((q) => ({
      id: q.id,
      commercialId: q.commercialId,
      reference: q.reference,
      clientName: state.clients.find((c) => c.id === q.clientId)?.name ?? "—",
      amountTtc: quoteTotals(state, q.id).totalTtc,
    }));

  return (
    <>
      <PageTitle eyebrow="Commercial" title="Commerciaux">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="size-4 text-teal-700" />
          Affaires abouties par personne
        </div>
      </PageTitle>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Chaque commercial a son compteur de closes. Wael, Alix et les autres apparaissent ici, isolés du tableau de bord.
      </p>
      <CommercialClosesView rows={rows} deals={deals} />
    </>
  );
}
