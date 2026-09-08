import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, nullIfEmpty, todayISO } from "@/lib/format";
import type { PaymentMethod, Tables } from "@/lib/supabase/types";

type Row = Tables<"payments"> & { client_name?: string; invoice_number?: string };

async function fetchPayments(): Promise<Row[]> {
  const [{ data, error }, { data: clients }, { data: invoices }] = await Promise.all([
    supabase.from("payments").select("*").order("paid_at", { ascending: false }),
    supabase.from("clients").select("id, company_name"),
    supabase.from("invoices").select("id, number"),
  ]);
  if (error) throw error;
  const cMap = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const iMap = new Map((invoices ?? []).map((i) => [i.id, i.number]));
  return (data ?? []).map((p) => ({
    ...p,
    client_name: cMap.get(p.client_id),
    invoice_number: iMap.get(p.invoice_id) ?? undefined,
  }));
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["payments"], queryFn: fetchPayments });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      [p.client_name, p.invoice_number, p.reference, p.method].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Paiements"
        description="Encaissements liés aux factures."
        actions={
          <RoleGate permission="payments:write">
            <Button variant="accent" onClick={() => navigate("/paiements/nouveau")}>
              <Plus className="size-4" />
              Nouveau paiement
            </Button>
          </RoleGate>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun paiement" />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Client</TH>
                <TH>Facture</TH>
                <TH>Montant</TH>
                <TH>Méthode</TH>
                <TH>Référence</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((p) => (
                <TR key={p.id}>
                  <TD>{formatDate(p.paid_at)}</TD>
                  <TD>
                    <Link to={`/clients/${p.client_id}`} className="hover:underline">
                      {p.client_name ?? "—"}
                    </Link>
                  </TD>
                  <TD>
                    <Link to={`/factures/${p.invoice_id}`} className="text-accent hover:underline">
                      {p.invoice_number ?? p.invoice_id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD className="font-medium">{formatCurrency(p.amount)}</TD>
                  <TD>{PAYMENT_METHOD_LABELS[p.method]}</TD>
                  <TD>{p.reference || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      )}
    </div>
  );
}

export function PaymentCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [invoiceId, setInvoiceId] = useState(params.get("invoice") ?? "");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["clients-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .neq("status", "archived")
        .order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoice-options", clientId],
    queryFn: async () => {
      let q = supabase
        .from("invoice_balances")
        .select("invoice_id, number, amount_due, client_id, status")
        .gt("amount_due", 0)
        .neq("status", "cancelled");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !invoiceId) throw new Error("Client et facture obligatoires");
      const value = Number(amount);
      if (!(value > 0)) throw new Error("Montant invalide");

      const { data, error } = await supabase
        .from("payments")
        .insert({
          client_id: clientId,
          invoice_id: invoiceId,
          amount: value,
          paid_at: paidAt,
          method,
          reference: nullIfEmpty(reference),
          note: nullIfEmpty(note),
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      // Refresh invoice payment status if RPC exists
      await supabase.rpc("refresh_invoice_payment_status", { p_invoice_id: invoiceId });

      await logActivity({
        activity_type: "PAYMENT_RECEIVED",
        title: `Paiement de ${formatCurrency(value)}`,
        client_id: clientId,
        created_by: user?.id,
        metadata: { payment_id: data.id, invoice_id: invoiceId },
      });

      return data.id as string;
    },
    onSuccess: async () => {
      toast.success("Paiement enregistré");
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      await qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/paiements");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Prefill amount from selected invoice due
  const selectedBalance = invoicesQuery.data?.find((i) => i.invoice_id === invoiceId);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nouveau paiement" />
      <Card>
        <CardContent className="grid gap-3 pt-5">
          <div>
            <Label>Client *</Label>
            <Select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setInvoiceId("");
              }}
            >
              <option value="">Sélectionner…</option>
              {(clientsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Facture *</Label>
            <Select
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const bal = invoicesQuery.data?.find((i) => i.invoice_id === e.target.value);
                if (bal && !amount) setAmount(String(bal.amount_due ?? ""));
              }}
            >
              <option value="">Sélectionner…</option>
              {(invoicesQuery.data ?? []).map((inv) => (
                <option key={inv.invoice_id!} value={inv.invoice_id!}>
                  {inv.number ?? inv.invoice_id!.slice(0, 8)} — dû {formatCurrency(inv.amount_due)}
                </option>
              ))}
            </Select>
            {selectedBalance ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Reste dû : {formatCurrency(selectedBalance.amount_due)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Montant *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Méthode</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Référence</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="accent" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Enregistrer
            </Button>
            <Button variant="outline" onClick={() => navigate("/paiements")}>
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
