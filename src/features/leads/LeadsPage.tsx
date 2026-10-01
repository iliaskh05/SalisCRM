import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadStatusBadge } from "@/components/ui/status-badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pager, usePagination } from "@/components/ui/pager";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import { LEAD_STATUS_LABELS, PRIORITY_LABELS, LEAD_PRIORITIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { LeadStatus, Tables } from "@/lib/supabase/types";

async function fetchLeads() {
  const { data, error } = await selectAll((from, to) =>
    supabase
      .from("leads")
      .select(
        "id, reference, company_name, contact_name, email, phone, city, source, status, priority, assigned_user, next_action, next_action_date, created_at, converted_client_id",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (error) throw error;
  return (data ?? []) as Tables<"leads">[];
}

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const statusFilter = (params.get("status") ?? "") as LeadStatus | "";
  const priorityFilter = params.get("priority") ?? "";
  const cityFilter = params.get("city") ?? "";
  const sourceFilter = params.get("source") ?? "";
  const assignedFilter = params.get("assigned") ?? "";

  const { data = [], isLoading, error } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });

  const cities = useMemo(
    () => [...new Set(data.map((l) => l.city).filter(Boolean) as string[])].sort(),
    [data],
  );
  const sources = useMemo(
    () => [...new Set(data.map((l) => l.source).filter(Boolean))].sort(),
    [data],
  );
  const assignees = useMemo(
    () => [...new Set(data.map((l) => l.assigned_user).filter(Boolean) as string[])].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (priorityFilter && l.priority !== priorityFilter) return false;
      if (cityFilter && l.city !== cityFilter) return false;
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (assignedFilter && l.assigned_user !== assignedFilter) return false;
      if (!q) return true;
      const hay = [l.company_name, l.contact_name, l.email, l.phone, l.city, l.reference]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, statusFilter, priorityFilter, cityFilter, sourceFilter, assignedFilter]);
  const pager = usePagination(filtered);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  if (isLoading) return <LoadingState label="Chargement des prospects…" />;
  if (error) {
    return <EmptyState title="Erreur de chargement" description={String(error)} />;
  }

  return (
    <div>
      <PageHeader
        title="Prospects"
        description="Même table leads que le site commercial — suivi commercial et conversion."
      />

      <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="relative md:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher (société, contact, email…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Tous les statuts</option>
          {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setFilter("priority", e.target.value)}>
          <option value="">Toutes priorités</option>
          {LEAD_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Select value={cityFilter} onChange={(e) => setFilter("city", e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={sourceFilter} onChange={(e) => setFilter("source", e.target.value)}>
          <option value="">Toutes les sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {assignees.length > 0 ? (
          <Select value={assignedFilter} onChange={(e) => setFilter("assigned", e.target.value)}>
            <option value="">Tous les assignés</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun prospect" description="Modifiez les filtres ou attendez de nouveaux leads." />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Référence</TH>
                  <TH>Société / Contact</TH>
                  <TH>Ville</TH>
                  <TH>Source</TH>
                  <TH>Statut</TH>
                  <TH>Priorité</TH>
                  <TH>Prochaine action</TH>
                  <TH>Créé</TH>
                </TR>
              </THead>
              <TBody>
                {pager.pageItems.map((lead) => (
                  <TR key={lead.id}>
                    <TD>
                      <Link to={`/prospects/${lead.id}`} className="font-medium text-accent hover:underline">
                        {lead.reference ?? lead.id.slice(0, 8)}
                      </Link>
                      {lead.converted_client_id ? (
                        <Badge variant="success" className="ml-2">
                          Converti
                        </Badge>
                      ) : null}
                    </TD>
                    <TD>
                      <div className="font-medium">{lead.company_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.contact_name || lead.email || "—"}
                      </div>
                    </TD>
                    <TD>{lead.city || "—"}</TD>
                    <TD>{lead.source || "—"}</TD>
                    <TD>
                      <LeadStatusBadge status={lead.status} />
                    </TD>
                    <TD>{lead.priority ? PRIORITY_LABELS[lead.priority] ?? lead.priority : "—"}</TD>
                    <TD>
                      <div className="text-sm">{lead.next_action || "—"}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(lead.next_action_date)}</div>
                    </TD>
                    <TD>{formatDate(lead.created_at)}</TD>
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
