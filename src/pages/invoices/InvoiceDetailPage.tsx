import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

async function fetchInvoice(id: string) {
  const [{ data: invoice, error }, { data: balance }, { data: items }, { data: payments }] =
    await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).single(),
      supabase.from("invoice_balances").select("*").eq("invoice_id", id).maybeSingle(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
      supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
    ]);
  if (error) throw error;
  const inv = invoice as Tables<"invoices">;
  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("id", inv.client_id)
    .maybeSingle();

  return {
    invoice: inv,
    balance,
    items: (items ?? []) as Tables<"invoice_items">[],
    payments: (payments ?? []) as Tables<"payments">[],
    client,
  };
}

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoice(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return <EmptyState title="Facture introuvable" description={String(query.error ?? "")} />;
  }

  const { invoice, balance, items, payments, client } = query.data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/factures")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={invoice.number ?? "Facture"}
        description={
          <>
            Client :{" "}
            <Link to={`/clients/${invoice.client_id}`} className="text-accent hover:underline">
              {client?.company_name ?? "—"}
            </Link>
            {" · "}
            Émise le {formatDate(invoice.issued_at)}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <InvoiceStatusBadge status={balance?.status ?? invoice.status} />
            <RoleGate permission="payments:write">
              {(balance?.amount_due ?? 0) > 0 && (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() =>
                    navigate(`/paiements/nouveau?client=${invoice.client_id}&invoice=${invoice.id}`)
                  }
                >
                  <Wallet className="size-3.5" />
                  Enregistrer un paiement
                </Button>
              )}
            </RoleGate>
          </div>
        }
      />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Facturation électronique 2026 : PDF lisible + couche structurée (Factur-X / UBL / CII) <b>prête pour transmission</b>. Aucune PDP n’est connectée — aucune transmission n’est prétendue réussie.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total TTC</p>
            <p className="text-lg font-semibold">{formatCurrency(balance?.total_ttc ?? invoice.total_ttc)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Payé</p>
            <p className="text-lg font-semibold">{formatCurrency(balance?.amount_paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reste dû</p>
            <p className="text-lg font-semibold">{formatCurrency(balance?.amount_due)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lignes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableShell className="rounded-none border-0">
              <Table className="min-w-0">
                <THead>
                  <TR>
                    <TH>Libellé</TH>
                    <TH>Qté</TH>
                    <TH>PU HT</TH>
                    <TH>TVA</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((item) => (
                    <TR key={item.id}>
                      <TD>{item.label}</TD>
                      <TD>{item.quantity}</TD>
                      <TD>{formatCurrency(item.unit_price_ht)}</TD>
                      <TD>{item.vat_rate}%</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paiements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Aucun paiement" className="py-6" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paid_at)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.reference || ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
