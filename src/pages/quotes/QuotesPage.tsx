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
import { QuoteStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { QuoteStatus, Tables } from "@/lib/supabase/types";

type Row = Tables<"quotes"> & { client_name?: string };

async function fetchQuotes(): Promise<Row[]> {
  const [{ data, error }, { data: clients }] = await Promise.all([
    supabase.from("quotes").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, company_name"),
  ]);
  if (error) throw error;
  const map = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  return (data ?? []).map((q) => ({ ...q, client_name: map.get(q.client_id) }));
}

export function QuotesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["quotes"], queryFn: fetchQuotes });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      return [row.reference, row.client_name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, search, status]);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Devis"
        description="Création, suivi et conversion en facture."
        actions={
          <RoleGate permission="quotes:write">
            <Button variant="accent" onClick={() => navigate("/devis/nouveau")}>
              <Plus className="size-4" />
              Nouveau devis
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
          {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun devis" />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TR>
                <TH>Référence</TH>
                <TH>Client</TH>
                <TH>Émis</TH>
                <TH>Validité</TH>
                <TH>Total TTC</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((q) => (
                <TR key={q.id}>
                  <TD>
                    <Link to={`/devis/${q.id}`} className="font-medium text-accent hover:underline">
                      {q.reference ?? q.id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{q.client_name ?? "—"}</TD>
                  <TD>{formatDate(q.issued_at)}</TD>
                  <TD>{formatDate(q.valid_until)}</TD>
                  <TD>{formatCurrency(q.total_ttc)}</TD>
                  <TD>
                    <QuoteStatusBadge status={q.status} />
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
