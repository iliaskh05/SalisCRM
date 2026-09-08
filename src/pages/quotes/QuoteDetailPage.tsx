import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { QuoteStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, nullIfEmpty, todayISO } from "@/lib/format";
import type { QuoteStatus, Tables } from "@/lib/supabase/types";

async function fetchQuote(id: string) {
  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error) throw error;
  const quote = data as Tables<"quotes">;
  const [{ data: items }, { data: client }] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
    supabase.from("clients").select("id, company_name").eq("id", quote.client_id).maybeSingle(),
  ]);
  return {
    quote,
    items: (items ?? []) as Tables<"quote_items">[],
    client,
  };
}

export function QuoteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuote(id),
    enabled: Boolean(id),
  });

  const quote = query.data?.quote;
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!quote) return;
    setStatus(quote.status);
    setNotes(quote.notes ?? "");
  }, [quote]);

  const save = useMutation({
    mutationFn: async () => {
      if (!quote) return;
      const { error } = await supabase
        .from("quotes")
        .update({
          status,
          notes: nullIfEmpty(notes),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", quote.id);
      if (error) throw error;

      if (status === "sent" && quote.status !== "sent") {
        await logActivity({
          activity_type: "QUOTE_SENT",
          title: "Devis envoyé",
          client_id: quote.client_id,
          created_by: user?.id,
          metadata: { quote_id: quote.id },
        });
      }
      if (status === "accepted" && quote.status !== "accepted") {
        await logActivity({
          activity_type: "QUOTE_ACCEPTED",
          title: "Devis accepté",
          client_id: quote.client_id,
          created_by: user?.id,
          metadata: { quote_id: quote.id },
        });
      }
    },
    onSuccess: async () => {
      toast.success("Devis mis à jour");
      await qc.invalidateQueries({ queryKey: ["quote", id] });
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!quote || !query.data) throw new Error("Devis introuvable");
      const items = query.data.items;
      if (items.length === 0) throw new Error("Aucune ligne à facturer");

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          client_id: quote.client_id,
          quote_id: quote.id,
          issued_at: todayISO(),
          due_at: null,
          status: "unpaid",
          notes: quote.notes,
          subtotal_ht: 0,
          vat_amount: 0,
          total_ttc: 0,
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsErr } = await supabase.from("invoice_items").insert(
        items.map((item, index) => ({
          invoice_id: invoice.id,
          label: item.label,
          description: item.description,
          quantity: item.quantity,
          unit_price_ht: item.unit_price_ht,
          vat_rate: item.vat_rate,
          position: index,
        })) as never,
      );
      if (itemsErr) throw itemsErr;

      if (quote.status !== "accepted") {
        await supabase
          .from("quotes")
          .update({ status: "accepted", updated_at: new Date().toISOString() } as never)
          .eq("id", quote.id);
      }

      await logActivity({
        activity_type: "INVOICE_CREATED",
        title: "Facture créée depuis devis",
        client_id: quote.client_id,
        created_by: user?.id,
        metadata: { invoice_id: invoice.id, quote_id: quote.id },
      });

      return invoice.id as string;
    },
    onSuccess: async (invoiceId) => {
      toast.success("Facture créée");
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await qc.invalidateQueries({ queryKey: ["quote", id] });
      navigate(`/factures/${invoiceId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return <EmptyState title="Devis introuvable" description={String(query.error ?? "")} />;
  }

  const { items, client } = query.data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/devis")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={quote!.reference ?? "Devis"}
        description={
          <>
            Client :{" "}
            <Link to={`/clients/${quote!.client_id}`} className="text-accent hover:underline">
              {client?.company_name ?? "—"}
            </Link>
            {" · "}
            Émis le {formatDate(quote!.issued_at)}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <QuoteStatusBadge status={quote!.status} />
            <RoleGate permission="invoices:write">
              {(quote!.status === "accepted" || quote!.status === "sent") && (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={createInvoice.isPending}
                  onClick={() => createInvoice.mutate()}
                >
                  <Receipt className="size-3.5" />
                  Créer facture
                </Button>
              )}
            </RoleGate>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                      <TD>
                        <div className="font-medium">{item.label}</div>
                        {item.description ? (
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        ) : null}
                      </TD>
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
            <CardTitle>Totaux & statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">HT</span>
              <span>{formatCurrency(quote!.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA</span>
              <span>{formatCurrency(quote!.vat_amount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>TTC</span>
              <span>{formatCurrency(quote!.total_ttc)}</span>
            </div>

            <RoleGate permission="quotes:write">
              <div className="space-y-2 border-t border-border pt-3">
                <Label>Statut</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                  {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {QUOTE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                  Enregistrer
                </Button>
              </div>
            </RoleGate>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
