import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { CommercialStat } from "@/lib/quotes/commercial-stats";

export type ClosedDeal = {
  id: string;
  commercialId: string;
  reference: string;
  clientName: string;
  amountTtc: number;
};

export function CommercialClosesView({
  rows,
  deals,
}: {
  rows: CommercialStat[];
  deals: ClosedDeal[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        Aucun commercial pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
            <p className="text-sm font-semibold text-ink">{row.name}</p>
            <p className="mt-2 font-serif text-5xl font-semibold tracking-tight text-teal-800">{row.closed}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              affaire{row.closed > 1 ? "s" : ""} aboutie{row.closed > 1 ? "s" : ""}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {row.issued} devis émis · {row.pipeline} en cours · {row.closingRate} % de closing
            </p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(row.amountClosed)}</p>
          </div>
        ))}
      </div>

      {rows.map((row) => {
        const mine = deals.filter((d) => d.commercialId === row.id);
        return (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle>
                {row.name}
                <span className="ml-2 font-normal text-muted-foreground">
                  — {row.closed} aboutie{row.closed > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {mine.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Aucune affaire aboutie pour le moment.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {mine.map((deal) => (
                    <li key={deal.id}>
                      <Link to={`/devis/${deal.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                        <div>
                          <p className="text-sm font-medium">{deal.clientName}</p>
                          <p className="text-xs text-muted-foreground">{deal.reference}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(deal.amountTtc)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
