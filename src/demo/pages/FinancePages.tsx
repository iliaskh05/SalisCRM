import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { QuotePreview, printElement } from "@/components/quotes/QuotePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { calculateQuote } from "@/lib/quotes/calculate";
import { E_INVOICE_LABELS } from "@/lib/quotes/labels";
import { invoiceBalance, useDemoStore } from "@/lib/demo/store";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvoiceBadge, Kpi, PageTitle, TableWrap, Td } from "@/demo/ui";
import { Wallet } from "lucide-react";

export function DemoInvoicesPage() {
  const { state } = useDemoStore();
  const navigate = useNavigate();
  return (
    <>
      <PageTitle eyebrow="Finance" title="Factures" />
      <Card>
        <TableWrap headers={["Facture", "Client", "Émise", "Échéance", "TTC", "Payé", "Reste", "Statut", "e-facture"]}>
          {state.invoices.map((inv) => {
            const bal = invoiceBalance(state, inv.id);
            return (
              <tr key={inv.id} className="border-t border-border hover:bg-muted/40">
                <Td><Link className="font-semibold hover:text-teal-700" to={`/factures/${inv.id}`}>{inv.number}</Link></Td>
                <Td>{state.clients.find((c) => c.id === inv.clientId)?.name}</Td>
                <Td>{formatDate(inv.issuedAt)}</Td>
                <Td>{formatDate(inv.dueAt)}</Td>
                <Td>{formatCurrency(bal.totalTtc)}</Td>
                <Td>{formatCurrency(bal.paid)}</Td>
                <Td className="font-semibold">{formatCurrency(bal.remaining)}</Td>
                <Td><InvoiceBadge status={bal.status} /></Td>
                <Td className="text-xs">{E_INVOICE_LABELS[inv.eStatus]}</Td>
              </tr>
            );
          })}
        </TableWrap>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Facturation électronique 2026 : PDF humain + données structurées prêtes. Aucune transmission vers une PDP n’est simulée comme réussie.</p>
      <Button className="mt-3" variant="outline" onClick={() => navigate("/factures/nouvelle")}>Nouvelle facture</Button>
    </>
  );
}

export function DemoInvoiceCreatePage() {
  const { state, createInvoiceFrom } = useDemoStore();
  const navigate = useNavigate();
  const [source, setSource] = useState("");
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Finance" title="Générer une facture" />
      <Card><CardContent className="space-y-3 pt-5">
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Depuis une intervention terminée ou un devis accepté…</option>
          {state.interventions.filter((i) => ["completed", "report_validated", "closed"].includes(i.status) && !i.invoiceId).map((i) => (
            <option key={i.id} value={`int:${i.id}`}>{i.reference} — {state.clients.find((c) => c.id === i.clientId)?.name}</option>
          ))}
          {state.quotes.filter((q) => ["accepted", "converted_intervention"].includes(q.status) && !q.invoiceId).map((q) => (
            <option key={q.id} value={`q:${q.id}`}>{q.reference}</option>
          ))}
        </Select>
        <Button variant="accent" onClick={() => {
          if (!source) { toast.error("Choisissez une source"); return; }
          const [kind, sid] = source.split(":");
          if (kind === "int") {
            const i = state.interventions.find((x) => x.id === sid);
            if (!i) return;
            const id = createInvoiceFrom({ interventionId: i.id, clientId: i.clientId, quoteId: i.quoteId ?? undefined });
            toast.success("Facture créée");
            navigate(`/factures/${id}`);
            return;
          }
          const q = state.quotes.find((x) => x.id === sid);
          if (!q) return;
          const id = createInvoiceFrom({ quoteId: q.id, clientId: q.clientId });
          toast.success("Facture créée");
          navigate(`/factures/${id}`);
        }}>Générer</Button>
      </CardContent></Card>
    </div>
  );
}

export function DemoInvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useDemoStore();
  const invoice = state.invoices.find((i) => i.id === id);
  if (!invoice) return <EmptyState title="Facture introuvable" />;
  const client = state.clients.find((c) => c.id === invoice.clientId);
  const lines = state.invoiceLines.filter((l) => l.invoiceId === invoice.id);
  const totals = calculateQuote(lines.map((l) => ({ label: l.label, quantity: l.quantity, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate })));
  const bal = invoiceBalance(state, invoice.id);

  return (
    <>
      <Button variant="ghost" size="sm" className="no-print" onClick={() => navigate("/factures")}>← Factures</Button>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <InvoiceBadge status={bal.status} />
        <Button size="sm" variant="outline" onClick={() => printElement(invoice.number)}>PDF / Imprimer</Button>
        {bal.remaining > 0 ? <Button size="sm" variant="accent" onClick={() => navigate(`/paiements/nouveau?invoice=${invoice.id}`)}>Enregistrer un paiement</Button> : null}
      </div>
      <div className="no-print mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Facturation électronique : <b>prête pour transmission</b> ({E_INVOICE_LABELS[invoice.eStatus]}). Formats prévus : Factur-X, UBL, CII. Aucune PDP connectée.
      </div>
      <div className="print-area">
        <QuotePreview documentKind="Facture" model={{
          reference: invoice.number,
          issuedAt: invoice.issuedAt,
          validUntil: invoice.dueAt,
          notes: invoice.notes,
          paymentTerms: invoice.paymentTerms,
          client: client ? { name: client.name, contact: client.contact, address: client.address, postalCode: client.postalCode, city: client.city, siret: client.siret } : { name: "—" },
          lines: lines.map((l, i) => ({ label: l.label, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate, lineTotalHt: totals.lines[i]?.lineTotalHt ?? 0 })),
          totals,
        }} />
      </div>
    </>
  );
}

export function DemoPaymentsPage() {
  const { state } = useDemoStore();
  const collected = state.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = state.invoices.reduce((s, i) => s + invoiceBalance(state, i.id).remaining, 0);
  const overdue = state.invoices.filter((i) => invoiceBalance(state, i.id).overdue).reduce((s, i) => s + invoiceBalance(state, i.id).remaining, 0);
  const navigate = useNavigate();
  return (
    <>
      <PageTitle eyebrow="Trésorerie" title="Paiements">
        <Button variant="accent" onClick={() => navigate("/paiements/nouveau")}><Wallet className="size-4" />Enregistrer un paiement</Button>
      </PageTitle>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Encaissé" value={formatCurrency(collected)} detail="Tous paiements" icon={Wallet} />
        <Kpi label="Reste dû" value={formatCurrency(remaining)} detail="Encours" icon={Wallet} tone="amber" />
        <Kpi label="En retard" value={formatCurrency(overdue)} detail="Échéances dépassées" icon={Wallet} tone="rose" />
      </div>
      <Card>
        <TableWrap headers={["Date", "Client", "Facture", "Mode", "Montant"]}>
          {state.payments.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <Td>{formatDate(p.paidAt)}</Td>
              <Td className="font-semibold">{state.clients.find((c) => c.id === p.clientId)?.name}</Td>
              <Td><Link to={`/factures/${p.invoiceId}`}>{state.invoices.find((i) => i.id === p.invoiceId)?.number}</Link></Td>
              <Td>{p.method}</Td>
              <Td className="font-semibold text-teal-700">+ {formatCurrency(p.amount)}</Td>
            </tr>
          ))}
        </TableWrap>
      </Card>
    </>
  );
}

export function DemoPaymentCreatePage() {
  const { state, recordPayment } = useDemoStore();
  const navigate = useNavigate();
  const [invoiceId, setInvoiceId] = useState(new URLSearchParams(window.location.search).get("invoice") ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"transfer" | "card" | "check" | "cash" | "other">("transfer");
  const bal = invoiceId ? invoiceBalance(state, invoiceId) : null;

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle eyebrow="Trésorerie" title="Enregistrer un paiement" />
      <Card><CardContent className="space-y-3 pt-5">
        <Select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const b = invoiceBalance(state, e.target.value); setAmount(String(b.remaining)); }}>
          <option value="">Facture…</option>
          {state.invoices.filter((i) => invoiceBalance(state, i.id).remaining > 0).map((i) => (
            <option key={i.id} value={i.id}>{i.number} — reste {formatCurrency(invoiceBalance(state, i.id).remaining)}</option>
          ))}
        </Select>
        {bal ? <p className="text-sm">Facturé {formatCurrency(bal.totalTtc)} · Payé {formatCurrency(bal.paid)} · Reste {formatCurrency(bal.remaining)}</p> : null}
        <Input type="number" min={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          <option value="transfer">Virement</option>
          <option value="card">Carte</option>
          <option value="check">Chèque</option>
          <option value="cash">Espèces</option>
          <option value="other">Autre</option>
        </Select>
        <Button variant="accent" onClick={() => {
          if (!invoiceId || Number(amount) <= 0) { toast.error("Montant invalide"); return; }
          if (bal && Number(amount) > bal.remaining + 0.01) { toast.error("Le montant dépasse le reste dû"); return; }
          recordPayment({ invoiceId, amount: Number(amount), method });
          toast.success("Paiement enregistré");
          navigate(`/factures/${invoiceId}`);
        }}>Enregistrer</Button>
      </CardContent></Card>
    </div>
  );
}
