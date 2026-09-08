import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useDemoStore } from "@/lib/demo/store";
import { formatCurrency } from "@/lib/format";
import { PageTitle, TableWrap, Td } from "@/demo/ui";

const leadLabel: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  quote_requested: "Devis demandé",
  quote_sent: "Devis envoyé",
  won: "Gagné",
  lost: "Perdu",
};

export function DemoLeadsPage() {
  const { state } = useDemoStore();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const filtered = state.leads.filter((l) => {
    if (zone && l.zone !== zone) return false;
    const hay = `${l.company} ${l.city} ${l.contact}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <>
      <PageTitle eyebrow="Commercial" title="Prospects" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Toutes les zones</option>
          {["Paris", "Île-de-France", "Lyon", "Dijon", "Troyes"].map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Aucun prospect" />
      ) : (
        <Card>
          <TableWrap headers={["Entreprise", "Contact", "Zone", "Origine", "Potentiel", "Statut", ""]}>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/40">
                <Td>
                  <Link className="font-semibold hover:text-teal-700" to={`/prospects/${l.id}`}>{l.company}</Link>
                  <p className="text-xs text-muted-foreground">{l.city}</p>
                </Td>
                <Td>{l.contact}<p className="text-xs text-muted-foreground">{l.phone}</p></Td>
                <Td>{l.zone}</Td>
                <Td>{l.source}</Td>
                <Td className="font-semibold">{formatCurrency(l.value)}</Td>
                <Td><Badge variant={l.status === "won" ? "success" : l.status === "qualified" ? "accent" : "default"}>{leadLabel[l.status]}</Badge></Td>
                <Td><Link to={`/prospects/${l.id}`}><ChevronRight className="size-4 text-muted-foreground" /></Link></Td>
              </tr>
            ))}
          </TableWrap>
        </Card>
      )}
    </>
  );
}

export function DemoLeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, convertLead, isProvider } = useDemoStore();
  const lead = state.leads.find((l) => l.id === id);
  const [confirm, setConfirm] = useState(false);
  if (!lead) return <EmptyState title="Prospect introuvable" />;

  return (
    <>
      <Link to="/prospects" className="text-sm font-medium text-teal-700">← Prospects</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">Prospect</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{lead.company}</h1>
          <p className="mt-1 text-muted-foreground">{lead.city} · {lead.contact}</p>
        </div>
        {!isProvider ? (
          lead.convertedClientId ? (
            <Button variant="accent" onClick={() => navigate(`/clients/${lead.convertedClientId}`)}>Ouvrir le client</Button>
          ) : (
            <Button variant="accent" onClick={() => setConfirm(true)}><Users className="size-4" />Convertir en client</Button>
          )
        ) : null}
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row k="Contact" v={lead.contact} />
            <Row k="Téléphone" v={lead.phone} />
            <Row k="Email" v={lead.email} />
            <Row k="Adresse" v={`${lead.address}, ${lead.postalCode} ${lead.city}`} />
            <Row k="SIREN / SIRET" v={`${lead.siren} / ${lead.siret}`} />
            <Row k="Activité" v={lead.businessType} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Qualification</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row k="Origine" v={lead.source} />
            <Row k="Potentiel" v={formatCurrency(lead.value)} />
            <Row k="Hotte" v={`${lead.hoodType} · ${lead.hoodLength} · ${lead.filterCount} filtres`} />
            <div className="rounded-xl bg-teal-50 p-4 text-teal-900">{lead.note}</div>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Convertir ce prospect en client ?"
        description="Les coordonnées, l’adresse et les données techniques seront reprises. Le lien prospect → client est conservé."
        confirmLabel="Convertir"
        onConfirm={() => {
          const clientId = convertLead(lead.id);
          toast.success("Client créé");
          setConfirm(false);
          navigate(`/clients/${clientId}`);
        }}
      />
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
