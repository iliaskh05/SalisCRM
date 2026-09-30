import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Pager, usePagination } from "@/components/ui/pager";
import { supabase } from "@/lib/supabase/client";
import { selectAll } from "@/lib/supabase/select-all";
import { isWebsiteQuoteRequest, sourceLabel } from "@/lib/quote-requests/source";
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, businessTypeLabel, URGENCY_LABELS } from "@/lib/quote-requests/status";
import { formatDateTime } from "@/lib/format";
import type { LeadStatus, Tables } from "@/lib/supabase/types";

async function fetchRequests() {
  const { data, error } = await selectAll((from, to) =>
    supabase.from("leads").select("*").order("created_at", { ascending: false }).order("id").range(from, to),
  );
  if (error) throw error;
  return ((data ?? []) as Tables<"leads">[]).filter((lead) => isWebsiteQuoteRequest(lead));
}

function RequestBadge({ status }: { status: LeadStatus }) {
  const tone =
    status === "new"
      ? "accent"
      : status === "won"
        ? "success"
        : status === "lost"
          ? "danger"
          : status === "quote_sent" || status === "quote_requested"
            ? "warning"
            : "default";
  return <Badge variant={tone}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function QuoteRequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["quote-requests"],
    queryFn: fetchRequests,
  });

  const cities = useMemo(() => [...new Set(data.map((l) => l.city).filter(Boolean) as string[])].sort(), [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((l) => {
      if (status && l.status !== status) return false;
      if (city && l.city !== city) return false;
      if (!q) return true;
      return [l.company_name, l.contact_name, l.email, l.city, l.reference].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [data, search, status, city]);
  const pager = usePagination(filtered);

  const inbox = data.filter((l) => l.status === "new").length;

  if (isLoading) return <LoadingState label="Chargement des demandes site…" />;
  if (error) return <EmptyState title="Erreur de chargement" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Demandes de devis"
        description="Demandes issues du site commercial (même table leads, sans duplication). Le devis interne se crée ensuite depuis la fiche."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Inbox className="size-4" />
        {inbox} nouvelle{inbox > 1 ? "s" : ""} · {data.length} au total
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Société, contact, ville…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Aucune demande site" description="Les soumissions du formulaire public apparaissent ici en temps réel." />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Demande</TH>
                  <TH>Établissement</TH>
                  <TH>Ville</TH>
                  <TH>Urgence</TH>
                  <TH>Statut</TH>
                  <TH>Reçue</TH>
                </TR>
              </THead>
              <TBody>
                {pager.pageItems.map((lead) => (
                  <TR key={lead.id}>
                    <TD>
                      <Link to={`/demandes-devis/${lead.id}`} className="font-medium text-accent hover:underline">
                        {lead.company_name || lead.contact_name || lead.reference || "Demande"}
                      </Link>
                      <div className="text-xs text-muted-foreground">{sourceLabel(lead.source, lead.landing_page)}</div>
                    </TD>
                    <TD>
                      {businessTypeLabel(lead.business_type)}
                      <div className="text-xs text-muted-foreground">{lead.contact_name}</div>
                    </TD>
                    <TD>
                      {[lead.postal_code, lead.city].filter(Boolean).join(" ") || "—"}
                    </TD>
                    <TD>{lead.urgency_level ? URGENCY_LABELS[lead.urgency_level] ?? lead.urgency_level : "—"}</TD>
                    <TD>
                      <RequestBadge status={lead.status} />
                    </TD>
                    <TD>{formatDateTime(lead.created_at)}</TD>
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
