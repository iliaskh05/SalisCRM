import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Printer, Receipt, Send, Wrench } from "lucide-react";
import { QuotePreview, printElement } from "@/components/quotes/QuotePreview";
import { SendQuoteDialog } from "@/components/quotes/SendQuoteDialog";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { getEmailProvider } from "@/lib/email/outbound";
import { quoteToDocument } from "@/lib/pdf/document-model";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { QuoteStatusBadge } from "@/components/ui/status-badge";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { COMPANY } from "@/lib/company";
import { calculateQuote } from "@/lib/quotes/calculate";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TRANSITIONS } from "@/lib/constants";
import { formatDate, nullIfEmpty, todayISO } from "@/lib/format";
import type { QuoteStatus, Tables } from "@/lib/supabase/types";

async function fetchQuote(id: string) {
  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error) throw error;
  const quote = data as Tables<"quotes">;
  const [{ data: items }, { data: client }] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
    supabase.from("clients").select("id, company_name, contact_name, phone, email, address, postal_code, city, siret").eq("id", quote.client_id).maybeSingle(),
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
  const [sendOpen, setSendOpen] = useState(false);

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
      // Facture + lignes + passage du devis en « accepté » en une transaction.
      // La base refuse la double facturation et les devis refusés / expirés.
      const { data: invoiceId, error } = await supabase.rpc("create_invoice_from_quote", {
        p_quote_id: quote.id,
      });
      if (error) throw error;
      const invoice = { id: invoiceId };

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

  const createIntervention = useMutation({
    mutationFn: async () => {
      if (!quote) throw new Error("Devis introuvable");
      // Intervention (prix HT remisé, adresse, installation) + devis accepté et lié, en une transaction
      const { data: interventionId, error } = await supabase.rpc("create_intervention_from_quote", {
        p_quote_id: quote.id,
      });
      if (error) throw error;
      return interventionId;
    },
    onSuccess: async (interventionId) => {
      toast.success("Intervention créée — données du devis reprises");
      await qc.invalidateQueries({ queryKey: ["interventions"] });
      await qc.invalidateQueries({ queryKey: ["quote", id] });
      navigate(`/interventions/${interventionId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return <EmptyState title="Devis introuvable" description={String(query.error ?? "")} />;
  }

  const { items, client, quote: loaded } = query.data;
  const totals = calculateQuote(
    items.map((i) => ({
      label: i.label,
      quantity: Number(i.quantity),
      unitPriceHt: Number(i.unit_price_ht),
      vatRate: Number(i.vat_rate),
    })),
    { discountHt: Number(loaded.discount_ht) || 0, depositAmount: Number(loaded.deposit_amount) || 0 },
  );

  return (
    <div>
      <Button variant="ghost" size="sm" className="no-print mb-3" onClick={() => navigate("/devis")}>
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
          <div className="no-print flex flex-wrap gap-2">
            <QuoteStatusBadge status={quote!.status} />
            <RoleGate permission="quotes:write">
              {quote!.status === "draft" || quote!.status === "sent" ? (
                <Button size="sm" variant="accent" onClick={() => setSendOpen(true)}>
                  <Send className="size-3.5" />
                  Envoyer le devis
                </Button>
              ) : null}
            </RoleGate>
            <Button size="sm" variant="outline" onClick={() => printElement(quote!.reference ?? "devis")}>
              <Printer className="size-3.5" />Imprimer
            </Button>
            <DownloadPdfButton
              document={quoteToDocument({ quote: loaded, items: query.data.items, client })}
            />
            <RoleGate permission="interventions:create">
              {quote!.status === "accepted" ? (
                <Button size="sm" variant="accent" disabled={createIntervention.isPending} onClick={() => createIntervention.mutate()}>
                  <Wrench className="size-3.5" />Créer l’intervention
                </Button>
              ) : null}
            </RoleGate>
            <RoleGate permission="invoices:write">
              {(quote!.status === "accepted" || quote!.status === "sent") && (
                <Button variant="outline" size="sm" disabled={createInvoice.isPending} onClick={() => createInvoice.mutate()}>
                  <Receipt className="size-3.5" />Créer facture
                </Button>
              )}
            </RoleGate>
          </div>
        }
      />

      {quote!.status === "accepted" ? (
        <div className="no-print mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Devis accepté. Créez l’intervention pour enchaîner sur le planning, les photos et le rapport.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <div className="print-area">
          <QuotePreview
            model={{
              reference: quote!.reference ?? quote!.id.slice(0, 8),
              issuedAt: quote!.issued_at ?? todayISO(),
              validUntil: quote!.valid_until,
              notes: quote!.notes ?? undefined,
              paymentTerms: COMPANY.paymentTermsDefault,
              client: {
                name: client?.company_name ?? "—",
                contact: client?.contact_name ?? undefined,
                address: client?.address ?? undefined,
                postalCode: client?.postal_code ?? undefined,
                city: client?.city ?? undefined,
                siret: client?.siret ?? undefined,
                email: client?.email ?? undefined,
                phone: client?.phone ?? undefined,
              },
              lines: items.map((item, i) => ({
                label: item.label,
                description: item.description ?? undefined,
                quantity: Number(item.quantity),
                unitPriceHt: Number(item.unit_price_ht),
                vatRate: Number(item.vat_rate),
                lineTotalHt: totals.lines[i]?.lineTotalHt ?? 0,
              })),
              totals,
            }}
          />
        </div>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <RoleGate permission="quotes:write">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                  {[loaded.status, ...QUOTE_STATUS_TRANSITIONS[loaded.status]].map((s) => (
                    <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>
                  ))}
                </Select>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                  Enregistrer
                </Button>
              </div>
            </RoleGate>
            <p className="text-xs text-muted-foreground">
              {getEmailProvider() === "resend"
                ? "Envoi e-mail configuré : le PDF part en pièce jointe."
                : "Envoi e-mail non configuré : transmettez le PDF vous-même, puis marquez le devis comme envoyé."}
            </p>
          </CardContent>
        </Card>
      </div>
      <SendQuoteDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        to={client?.email ?? ""}
        clientName={client?.company_name ?? "Client"}
        reference={quote!.reference ?? quote!.id.slice(0, 8)}
        validUntil={quote!.valid_until}
        document={quoteToDocument({ quote: loaded, items, client })}
        onConfirm={async (delivery) => {
          const { error } = await supabase
            .from("quotes")
            .update({ status: "sent", updated_at: new Date().toISOString() } as never)
            .eq("id", quote!.id);
          if (error) throw error;
          if (quote!.lead_id) {
            await supabase
              .from("leads")
              .update({ status: "quote_sent", updated_at: new Date().toISOString() } as never)
              .eq("id", quote!.lead_id);
          }
          await logActivity({
            activity_type: "QUOTE_SENT",
            title: delivery === "sent" ? "Devis envoyé par e-mail" : "Devis marqué comme envoyé (transmis manuellement)",
            client_id: quote!.client_id,
            lead_id: quote!.lead_id,
            created_by: user?.id,
            metadata: { quote_id: quote!.id, delivery },
          });
          await qc.invalidateQueries({ queryKey: ["quote", id] });
          await qc.invalidateQueries({ queryKey: ["quotes"] });
          await qc.invalidateQueries({ queryKey: ["quote-requests"] });
        }}
      />
    </div>
  );
}
