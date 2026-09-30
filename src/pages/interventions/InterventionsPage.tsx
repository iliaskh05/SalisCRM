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
import { InterventionStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { Pager, usePagination } from "@/components/ui/pager";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import { INTERVENTION_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InterventionStatus, Tables } from "@/lib/supabase/types";

type Row = Tables<"interventions"> & { client_name?: string; provider_name?: string };

async function fetchInterventions(): Promise<Row[]> {
  const [{ data, error }, { data: clients }, { data: providers }] = await Promise.all([
    selectAll((from, to) => supabase.from("interventions").select("*").order("scheduled_date", { ascending: false }).order("id").range(from, to)),
    selectAll((from, to) => supabase.from("clients").select("id, company_name").order("id").range(from, to)),
    supabase.from("providers").select("id, name"),
  ]);
  if (error) throw error;
  const cMap = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const pMap = new Map((providers ?? []).map((p) => [p.id, p.name]));
  return (data ?? []).map((i) => ({
    ...i,
    client_name: cMap.get(i.client_id),
    provider_name: i.provider_id ? pMap.get(i.provider_id) : undefined,
  }));
}

export function InterventionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["interventions"],
    queryFn: fetchInterventions,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((i) => {
      if (status && i.status !== status) return false;
      if (!q) return true;
      return [i.reference, i.client_name, i.service_type, i.provider_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, status]);
  const pager = usePagination(filtered);

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Interventions"
        description="Planification et suivi des interventions terrain."
        actions={
          <RoleGate permission="interventions:create">
            <Button variant="accent" onClick={() => navigate("/interventions/nouvelle")}>
              <Plus className="size-4" />
              Nouvelle intervention
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
          {(Object.keys(INTERVENTION_STATUS_LABELS) as InterventionStatus[]).map((s) => (
            <option key={s} value={s}>
              {INTERVENTION_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucune intervention" />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Référence</TH>
                  <TH>Client</TH>
                  <TH>Date</TH>
                  <TH>Créneau</TH>
                  <TH>Prestataire</TH>
                  <TH>Service</TH>
                  <TH>Prix HT</TH>
                  <TH>Statut</TH>
                </TR>
              </THead>
              <TBody>
                {pager.pageItems.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <Link to={`/interventions/${i.id}`} className="font-medium text-accent hover:underline">
                        {i.reference ?? i.id.slice(0, 8)}
                      </Link>
                    </TD>
                    <TD>{i.client_name ?? "—"}</TD>
                    <TD>{formatDate(i.scheduled_date)}</TD>
                    <TD>{i.time_slot || "—"}</TD>
                    <TD>{i.provider_name || "—"}</TD>
                    <TD>{i.service_type || "—"}</TD>
                    <TD>{formatCurrency(i.price_ht)}</TD>
                    <TD>
                      <InterventionStatusBadge status={i.status} />
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
