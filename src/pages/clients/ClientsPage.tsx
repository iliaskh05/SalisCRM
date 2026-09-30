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
import { ClientStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { Pager, usePagination } from "@/components/ui/pager";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ClientStatus, Tables } from "@/lib/supabase/types";

type ClientRow = Tables<"clients"> & {
  financial?: {
    total_invoiced: number;
    total_paid: number;
    amount_due: number;
    last_intervention_at: string | null;
    next_intervention_at: string | null;
  };
};

async function fetchClients(): Promise<ClientRow[]> {
  const [{ data: clients, error }, { data: summaries }] = await Promise.all([
    selectAll((from, to) => supabase.from("clients").select("*").order("created_at", { ascending: false }).order("id").range(from, to)),
    selectAll((from, to) => supabase.from("client_financial_summary").select("*").order("client_id").range(from, to)),
  ]);
  if (error) throw error;
  const map = new Map((summaries ?? []).map((s) => [s.client_id, s]));
  return (clients ?? []).map((c) => ({
    ...c,
    financial: map.get(c.id)
      ? {
          total_invoiced: Number(map.get(c.id)!.total_invoiced ?? 0),
          total_paid: Number(map.get(c.id)!.total_paid ?? 0),
          amount_due: Number(map.get(c.id)!.amount_due ?? 0),
          last_intervention_at: map.get(c.id)!.last_intervention_at,
          next_intervention_at: map.get(c.id)!.next_intervention_at,
        }
      : undefined,
  }));
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (status && c.status !== status) return false;
      if (!q) return true;
      const hay = [c.reference, c.company_name, c.contact_name, c.email, c.city, c.business_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, status]);
  const pager = usePagination(filtered);

  if (isLoading) return <LoadingState label="Chargement des clients…" />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Dossiers clients, suivi technique et financier."
        actions={
          <RoleGate permission="clients:write">
            <Button variant="accent" onClick={() => navigate("/clients/nouveau")}>
              <Plus className="size-4" />
              Nouveau client
            </Button>
          </RoleGate>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">Tous les statuts</option>
          {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun client" />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Référence</TH>
                  <TH>Société</TH>
                  <TH>Contact</TH>
                  <TH>Ville</TH>
                  <TH>Activité</TH>
                  <TH>Dernière / Prochaine</TH>
                  <TH>Facturé</TH>
                  <TH>Dû</TH>
                  <TH>Statut</TH>
                </TR>
              </THead>
              <TBody>
                {pager.pageItems.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link to={`/clients/${c.id}`} className="font-medium text-accent hover:underline">
                        {c.reference ?? c.id.slice(0, 8)}
                      </Link>
                    </TD>
                    <TD className="font-medium">{c.company_name}</TD>
                    <TD>
                      <div>{c.contact_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || c.email || ""}</div>
                    </TD>
                    <TD>{c.city || "—"}</TD>
                    <TD>{c.business_type || "—"}</TD>
                    <TD className="text-xs">
                      <div>Dernière : {formatDate(c.financial?.last_intervention_at)}</div>
                      <div>Prochaine : {formatDate(c.financial?.next_intervention_at)}</div>
                    </TD>
                    <TD>{formatCurrency(c.financial?.total_invoiced)}</TD>
                    <TD>{formatCurrency(c.financial?.amount_due)}</TD>
                    <TD>
                      <ClientStatusBadge status={c.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
          <Pager pager={pager} />
        </>
      )}
    </div>
  );
}
