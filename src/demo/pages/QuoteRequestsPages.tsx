import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FileText, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestPhotos } from "@/components/media/RequestPhotos";
import { useDemoStore } from "@/lib/demo/store";
import { isWebsiteQuoteRequest, sourceLabel } from "@/lib/quote-requests/source";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  businessTypeLabel,
  URGENCY_LABELS,
  FREQUENCY_LABELS,
  REQUEST_TYPE_LABELS,
  yesNo,
} from "@/lib/quote-requests/status";
import { formatDateTime } from "@/lib/format";
import { PageTitle, TableWrap, Td } from "@/demo/ui";
import type { DemoLeadStatus } from "@/lib/demo/types";

function RequestBadge({ status }: { status: DemoLeadStatus }) {
  const tone =
    status === "new" ? "accent" : status === "won" ? "success" : status === "lost" ? "danger" : status === "quote_sent" || status === "quote_requested" ? "warning" : "default";
  return <Badge variant={tone}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="text-sm font-medium">{v || "—"}</p>
    </div>
  );
}

export function DemoQuoteRequestsPage() {
  const { state, simulateWebsiteRequest, isProvider } = useDemoStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const requests = state.leads.filter((l) => isWebsiteQuoteRequest(l));
  const filtered = useMemo(() => {
    return requests.filter((l) => {
      if (status && l.status !== status) return false;
      const hay = `${l.company} ${l.contact} ${l.city}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [requests, q, status]);
  const inbox = requests.filter((l) => l.status === "new").length;

  if (isProvider) return <EmptyState title="Réservé à la direction" />;

  return (
    <>
      <PageTitle eyebrow="Acquisition" title="Demandes de devis">
        <Button
          variant="outline"
          onClick={() => {
            const id = simulateWebsiteRequest();
            toast.info("Nouvelle demande de devis", { description: "Simulation du formulaire public." });
            navigate(`/demandes-devis/${id}`);
          }}
        >
          Simuler une demande site
        </Button>
      </PageTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Inbox du site commercial — même objet métier que les leads, sans copie de données. {inbox} nouvelle{inbox > 1 ? "s" : ""}.
      </p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <Card>
          <TableWrap headers={["Demande", "Établissement", "Ville", "Urgence", "Statut", "Reçue"]}>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/40">
                <Td>
                  <Link className="font-semibold hover:text-teal-700" to={`/demandes-devis/${l.id}`}>
                    {l.company}
                  </Link>
                  <p className="text-xs text-muted-foreground">{sourceLabel(l.source, l.landingPage)}</p>
                </Td>
                <Td>
                  {businessTypeLabel(l.businessType)}
                  <p className="text-xs text-muted-foreground">{l.contact}</p>
                </Td>
                <Td>
                  {l.postalCode} {l.city}
                </Td>
                <Td>{URGENCY_LABELS[l.urgency] ?? l.urgency}</Td>
                <Td>
                  <RequestBadge status={l.status} />
                </Td>
                <Td>{formatDateTime(l.submittedAt)}</Td>
              </tr>
            ))}
          </TableWrap>
        </Card>
      )}
    </>
  );
}

export function DemoQuoteRequestDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state, updateLead, isProvider } = useDemoStore();
  const lead = state.leads.find((l) => l.id === id);
  const quote = lead?.quoteId ? state.quotes.find((q) => q.id === lead.quoteId) : undefined;

  if (!lead) return <EmptyState title="Demande introuvable" />;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/demandes-devis")}>
        <ArrowLeft className="size-4" />
        Demandes de devis
      </Button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">Demande site</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{lead.company}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reçue le {formatDateTime(lead.submittedAt)} · {sourceLabel(lead.source, lead.landingPage)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RequestBadge status={lead.status} />
          {!isProvider ? (
            quote ? (
              <Button variant="accent" onClick={() => navigate(`/devis/${quote.id}`)}>
                <FileText className="size-4" />
                Ouvrir le devis
              </Button>
            ) : (
              <Button variant="accent" onClick={() => navigate(`/devis/nouveau?lead=${lead.id}`)}>
                <FileText className="size-4" />
                Créer le devis
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Row k="Société" v={lead.company} />
            <Row k="Contact" v={lead.contact} />
            <Row k="Téléphone" v={lead.phone} />
            <Row k="Email" v={lead.email} />
            <Row k="Adresse" v={`${lead.address}, ${lead.postalCode} ${lead.city}`} />
            <Row k="Consentement" v={yesNo(lead.consent)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Établissement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Row k="Type" v={businessTypeLabel(lead.businessType)} />
            <Row k="Demande" v={REQUEST_TYPE_LABELS[lead.requestType] ?? lead.requestType} />
            <Row k="Fréquence" v={FREQUENCY_LABELS[lead.maintenanceFrequency] ?? lead.maintenanceFrequency} />
            <Row k="Urgence" v={URGENCY_LABELS[lead.urgency] ?? lead.urgency} />
            <Row k="Dernier nettoyage" v={lead.lastCleaning} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Suivi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={lead.status}
              onChange={(e) => {
                updateLead(lead.id, { status: e.target.value as DemoLeadStatus });
                toast.success("Statut mis à jour");
              }}
            >
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REQUEST_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            {lead.convertedClientId ? (
              <Link to={`/clients/${lead.convertedClientId}`} className="block text-sm text-teal-700">
                Ouvrir le client
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Installation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Row k="Longueur hotte" v={lead.hoodLength} />
            <Row k="Type de hotte" v={lead.hoodType} />
            <Row k="Filtres" v={`${lead.filterCount} · ${lead.filterType}`} />
            <Row k="Conduits" v={lead.ductPresent ? lead.ductLength || "Oui" : "Non"} />
            <Row k="Moteur" v={lead.motorPresent ? lead.motorType || "Oui" : "Non"} />
            <Row k="Accessibilité" v={lead.accessibility} />
            <Row k="Encrassement" v={lead.soilLevel} />
            <Row k="Nuit" v={yesNo(lead.nightIntervention)} />
            <Row k="Créneau" v={lead.schedulePreference} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">{lead.note}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4" />
            Photos transmises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RequestPhotos photos={lead.photos} />
        </CardContent>
      </Card>
    </div>
  );
}
