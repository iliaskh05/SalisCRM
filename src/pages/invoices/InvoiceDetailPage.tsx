import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth/permissions";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { creditNoteToDocument, invoiceToDocument } from "@/lib/pdf/document-model";
import { supabase } from "@/lib/supabase/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

async function fetchInvoice(id: string) {
  const [
    { data: invoice, error },
    { data: balance },
    { data: items },
    { data: payments },
    { data: creditNote },
  ] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_balances").select("*").eq("invoice_id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
    supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
    supabase.from("credit_notes").select("*").eq("invoice_id", id).maybeSingle(),
  ]);
  if (error) throw error;
  const inv = invoice as Tables<"invoices">;
  const [{ data: client }, { data: sourceQuote }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company_name, contact_name, phone, email, address, postal_code, city, siret")
      .eq("id", inv.client_id)
      .maybeSingle(),
    inv.quote_id
      ? supabase.from("quotes").select("reference").eq("id", inv.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    invoice: inv,
    balance,
    items: (items ?? []) as Tables<"invoice_items">[],
    payments: (payments ?? []) as Tables<"payments">[],
    creditNote: creditNote as Tables<"credit_notes"> | null,
    quoteReference: sourceQuote?.reference ?? null,
    client,
  };
}

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoice(id),
    enabled: Boolean(id),
  });

  // Une facture émise ne se modifie ni ne se supprime : on l'annule par un avoir.
  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_invoice", { p_invoice_id: id, p_reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Facture annulée — avoir émis");
      setCancelOpen(false);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["invoice", id] });
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return <EmptyState title="Facture introuvable" description={String(query.error ?? "")} />;
  }

  const { invoice, balance, items, payments, creditNote, quoteReference, client } = query.data;
  const canCancel = isAdmin(role) && invoice.status !== "cancelled" && payments.length === 0;

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
            <DownloadPdfButton
              label="Facture Factur-X"
              document={invoiceToDocument({ invoice, items, client, payments, quoteReference })}
            />
            {creditNote && (
              <DownloadPdfButton
                label="Avoir Factur-X"
                document={creditNoteToDocument({ creditNote, client, invoiceNumber: invoice.number, invoiceIssuedAt: invoice.issued_at })}
              />
            )}
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
            {canCancel && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                <Ban className="size-3.5" />
                Annuler par avoir
              </Button>
            )}
          </div>
        }
      />

      {invoice.status === "cancelled" && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          Facture annulée{invoice.cancelled_at ? ` le ${formatDate(invoice.cancelled_at)}` : ""}
          {creditNote ? <> par l’avoir <b>{creditNote.number}</b></> : null}
          {invoice.cancellation_reason ? ` — motif : ${invoice.cancellation_reason}` : ""}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Le fichier téléchargé est une facture <b>Factur-X</b> (PDF/A-3 contenant le XML EN 16931), contrôlée avec le validateur Mustang. Elle n’est
        <b> pas transmise automatiquement</b> : aucune plateforme agréée (PDP) n’est connectée, c’est à vous de la déposer sur votre plateforme ou de l’envoyer au client.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total TTC</p>
            <p className="text-lg font-semibold">{formatCurrency(balance?.total_ttc ?? invoice.total_ttc)}</p>
            {Number(invoice.discount_ht) > 0 && (
              <p className="text-xs text-muted-foreground">dont remise HT : − {formatCurrency(invoice.discount_ht)}</p>
            )}
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

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Annuler la facture ${invoice.number ?? ""}`}
        description="Un avoir du même montant sera émis. La facture restera consultable mais ne pourra plus être modifiée ni encaissée. Action définitive."
      >
        <div className="space-y-3">
          <div>
            <Label>Motif *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : erreur de client, prestation annulée…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>
              Retour
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!reason.trim() || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Patientez…" : "Émettre l’avoir"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
