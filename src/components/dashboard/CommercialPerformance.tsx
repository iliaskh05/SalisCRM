import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { CommercialStat } from "@/lib/quotes/commercial-stats";

export function CommercialPerformance({ rows }: { rows: CommercialStat[] }) {
  const closed = rows.reduce((s, r) => s + r.closed, 0);
  const issued = rows.reduce((s, r) => s + r.issued, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Closes par commercial</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {closed} affaire{closed > 1 ? "s" : ""} aboutie{closed > 1 ? "s" : ""}
            {issued ? ` sur ${issued} devis émis` : ""} — une ligne par personne.
          </p>
        </div>
        <Link className="text-xs font-semibold text-teal-700" to="/commerciaux">
          Onglet Commerciaux
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ajoutez des commerciaux : leurs affaires abouties apparaîtront ici.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-border bg-muted/40 px-4 py-4">
                  <p className="text-sm font-semibold text-ink">{row.name}</p>
                  <p className="mt-2 font-serif text-4xl font-semibold tracking-tight text-teal-800">{row.closed}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    affaire{row.closed > 1 ? "s" : ""} aboutie{row.closed > 1 ? "s" : ""}
                    {row.issued ? ` · ${row.closingRate} % de closing` : ""}
                  </p>
                  <p className="mt-2 text-xs font-medium">{formatCurrency(row.amountClosed)}</p>
                </div>
              ))}
            </div>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/60 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3">Commercial</th>
                    <th className="px-5 py-3">Devis émis</th>
                    <th className="px-5 py-3">Aboutis</th>
                    <th className="px-5 py-3">En cours</th>
                    <th className="px-5 py-3">Closing</th>
                    <th className="px-5 py-3 text-right">CA abouti</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-5 py-3 font-medium">{row.name}</td>
                      <td className="px-5 py-3">{row.issued}</td>
                      <td className="px-5 py-3 font-semibold text-teal-800">{row.closed}</td>
                      <td className="px-5 py-3">{row.pipeline}</td>
                      <td className="px-5 py-3">{row.closingRate} %</td>
                      <td className="px-5 py-3 text-right font-medium">{formatCurrency(row.amountClosed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
