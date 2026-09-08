import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/supabase/types";

type Row = {
  invoice_id: string;
  client_id: string;
  number: string | null;
  total_ttc: number;
  amount_paid: number;
  amount_due: number;
  status: InvoiceStatus;
  due_at: string | null;
  issued_at: string;
  client_name?: string;
};

async function fetchInvoices(): Promise<Row[]> {
  const [{ data, error }, { data: clients }] = await Promise.all([
    supabase.from("invoice_balances").select("*").order("issued_at", { ascending: false }),
    supabase.from("clients").select("id, company_name"),
  ]);
  if (error) throw error;
  const map = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  return (data ?? []).map((inv) => ({
    invoice_id: inv.invoice_id!,
    client_id: inv.client_id!,
    number: inv.number,
    total_ttc: Number(inv.total_ttc ?? 0),
    amount_paid: Number(inv.amount_paid ?? 0),
    amount_due: Number(inv.amount_due ?? 0),
    status: inv.status!,
    due_at: inv.due_at,
    issued_at: inv.issued_at!,
    client_name: inv.client_id ? map.get(inv.client_id) : undefined,
  }));
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      return [row.number, row.client_name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, search, status]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Suivi des montants facturés, encaissés et dus."
        actions={
          <RoleGate permission="invoices:write">
            <Button variant="accent" onClick={() => navigate("/factures/nouvelle")}>
              <Plus className="size-4" />
              Nouvelle facture
            </Button>
          </RoleGate>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">Tous les statuts</option>
          {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucune facture" />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TR>
                <TH>Numéro</TH>
                <TH>Client</TH>
                <TH>Émise</TH>
                <TH>Échéance</TH>
                <TH>TTC</TH>
                <TH>Payé</TH>
                <TH>Dû</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((inv) => (
                <TR key={inv.invoice_id}>
                  <TD>
                    <Link to={`/factures/${inv.invoice_id}`} className="font-medium text-accent hover:underline">
                      {inv.number ?? inv.invoice_id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{inv.client_name ?? "—"}</TD>
                  <TD>{formatDate(inv.issued_at)}</TD>
                  <TD>{formatDate(inv.due_at)}</TD>
                  <TD>{formatCurrency(inv.total_ttc)}</TD>
                  <TD>{formatCurrency(inv.amount_paid)}</TD>
                  <TD>{formatCurrency(inv.amount_due)}</TD>
                  <TD>
                    <InvoiceStatusBadge status={inv.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      )}
    </div>
  );
}
