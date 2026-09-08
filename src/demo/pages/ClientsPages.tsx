import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, FileText, Wrench } from "lucide-react";
import { BeforeAfterSlider } from "@/components/media/BeforeAfterSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { invoiceBalance, quoteTotals, useDemoStore } from "@/lib/demo/store";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { InterventionBadge, InvoiceBadge, PageTitle, QuoteBadge, TableWrap, Td } from "@/demo/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const CLIENT_TABS = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "info", label: "Informations" },
  { id: "installations", label: "Installations" },
  { id: "quotes", label: "Devis" },
  { id: "interventions", label: "Interventions" },
  { id: "reports", label: "Rapports" },
  { id: "photos", label: "Photos" },
  { id: "documents", label: "Documents" },
  { id: "invoices", label: "Factures" },
  { id: "payments", label: "Paiements" },
  { id: "profit", label: "Rentabilité" },
  { id: "history", label: "Historique" },
  { id: "notes", label: "Notes internes" },
];

export function DemoClientsPage() {
  const { state } = useDemoStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const filtered = state.clients.filter((c) => {
    if (zone && c.zone !== zone) return false;
    return `${c.name} ${c.city} ${c.contact}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <PageTitle eyebrow="Portefeuille" title="Clients">
        <Button variant="accent" onClick={() => navigate("/clients/nouveau")}><Building2 className="size-4" />Nouveau client</Button>
      </PageTitle>
      <div className="mb-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" />
        <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Toutes les zones</option>
          {["Paris", "Île-de-France", "Lyon", "Dijon", "Troyes"].map((z) => <option key={z}>{z}</option>)}
        </select>
      </div>
      <Card>
        <TableWrap headers={["Client", "Ville", "Contrat", "Installations", ""]}>
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-muted/40">
              <Td>
                <Link className="font-semibold hover:text-teal-700" to={`/clients/${c.id}`}>{c.name}</Link>
                <p className="text-xs text-muted-foreground">{c.contact}</p>
              </Td>
              <Td>{c.city}</Td>
              <Td>{c.contract}</Td>
              <Td>{state.installations.filter((i) => i.clientId === c.id).length}</Td>
              <Td><Link to={`/clients/${c.id}`} className="text-teal-700">Ouvrir</Link></Td>
            </tr>
          ))}
        </TableWrap>
      </Card>
    </>
  );
}

export function DemoClientCreatePage() {
  const { createClient } = useDemoStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "", address: "", postalCode: "", city: "Paris", zone: "Paris" as const, siren: "", siret: "", businessType: "Restaurant", notes: "" });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Portefeuille" title="Nouveau client" />
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          {(["name", "contact", "phone", "email", "address", "postalCode", "city", "siren", "siret", "businessType"] as const).map((k) => (
            <div key={k} className={k === "address" || k === "name" ? "sm:col-span-2" : ""}>
              <label className="text-xs font-medium">{k}</label>
              <Input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <Button variant="accent" onClick={() => {
              if (!form.name.trim()) { toast.error("Raison sociale obligatoire"); return; }
              const id = createClient(form);
              toast.success("Client créé");
              navigate(`/clients/${id}`);
            }}>Créer</Button>
            <Button variant="outline" onClick={() => navigate("/clients")}>Annuler</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DemoClientDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state, updateClient, isProvider, deleteDocument } = useDemoStore();
  const client = state.clients.find((c) => c.id === id);
  const [tab, setTab] = useState("overview");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  if (!client) return <EmptyState title="Client introuvable" />;

  const installs = state.installations.filter((i) => i.clientId === client.id);
  const quotes = state.quotes.filter((q) => q.clientId === client.id);
  const interventions = state.interventions.filter((i) => i.clientId === client.id);
  const photos = state.photos.filter((p) => p.clientId === client.id);
  const invoices = state.invoices.filter((i) => i.clientId === client.id);
  const payments = state.payments.filter((p) => p.clientId === client.id);
  const docs = state.documents.filter((d) => d.clientId === client.id);
  const timeline = state.activities.filter((a) => a.clientId === client.id);
  const reports = state.reports.filter((r) => interventions.some((i) => i.id === r.interventionId));
  const before = photos.find((p) => p.kind === "before");
  const after = photos.find((p) => p.kind === "after");
  const billed = invoices.reduce((s, i) => s + invoiceBalance(state, i.id).totalTtc, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const productCost = state.products.filter((p) => interventions.some((i) => i.id === p.interventionId)).reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const providerCost = interventions.reduce((s, i) => s + (state.providers.find((p) => p.id === i.providerId)?.costRate ?? 0), 0);

  const tabs = isProvider ? CLIENT_TABS.filter((t) => !["profit", "invoices", "payments"].includes(t.id)) : CLIENT_TABS;

  return (
    <>
      <Link to="/clients" className="text-sm font-medium text-teal-700">← Clients</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">Fiche client 360°</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold">{client.name}</h1>
          <p className="text-muted-foreground">{client.city} · {client.businessType}</p>
        </div>
        {!isProvider ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/devis/nouveau?client=${client.id}`)}><FileText className="size-4" />Créer un devis</Button>
            <Button variant="accent" onClick={() => navigate(`/interventions/nouvelle?client=${client.id}`)}><Wrench className="size-4" />Intervention</Button>
          </div>
        ) : null}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mt-6 mb-4" />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{client.contact} · {client.phone}</p>
              <p>{client.email}</p>
              <p>{client.address}, {client.postalCode} {client.city}</p>
              <p>SIRET {client.siret}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Synthèse</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Devis : {quotes.length}</p>
              <p>Interventions : {interventions.length}</p>
              {!isProvider ? <p>Facturé : {formatCurrency(billed)} · Encaissé : {formatCurrency(paid)}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Dernière activité</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {timeline.slice(0, 4).map((a) => <p key={a.id}>{a.title}</p>)}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "info" && (
        <Card><CardContent className="grid gap-2 pt-5 text-sm sm:grid-cols-2">
          <p><b>Raison sociale</b><br />{client.name}</p>
          <p><b>Contact</b><br />{client.contact}</p>
          <p><b>SIREN</b><br />{client.siren}</p>
          <p><b>SIRET</b><br />{client.siret}</p>
          <p className="sm:col-span-2"><b>Adresse</b><br />{client.address}, {client.postalCode} {client.city}</p>
        </CardContent></Card>
      )}

      {tab === "installations" && (
        <div className="grid gap-3 md:grid-cols-2">
          {installs.map((ins) => (
            <Card key={ins.id}><CardContent className="p-5 text-sm">
              <p className="font-semibold">{ins.label}</p>
              <p className="mt-2 text-muted-foreground">{ins.hoodType} · {ins.hoodLength} · {ins.filterCount} {ins.filterType}</p>
              <p className="text-muted-foreground">Conduit {ins.ductPresent ? ins.ductLength : "non"} · Moteur {ins.motorType}</p>
              <p className="mt-2">{ins.remarks}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      {tab === "quotes" && <List items={quotes.map((q) => ({ id: q.id, href: `/devis/${q.id}`, title: q.reference, subtitle: formatCurrency(quoteTotals(state, q.id).totalTtc), badge: <QuoteBadge status={q.status} /> }))} empty="Aucun devis" />}
      {tab === "interventions" && <List items={interventions.map((i) => ({ id: i.id, href: `/interventions/${i.id}`, title: i.reference, subtitle: `${i.date} · ${i.service}`, badge: <InterventionBadge status={i.status} /> }))} empty="Aucune intervention" />}
      {tab === "reports" && <List items={reports.map((r) => ({ id: r.id, href: `/interventions/${r.interventionId}/report`, title: "Rapport d’intervention", subtitle: r.validatedAt ? "Validé" : "À valider", badge: null }))} empty="Aucun rapport" />}
      {tab === "photos" && (
        <div className="space-y-4">
          {before && after ? <BeforeAfterSlider beforeSrc={before.url} afterSrc={after.url} /> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {photos.map((p) => <img key={p.id} src={p.url} alt={p.comment} className="h-40 w-full rounded-xl object-cover" />)}
          </div>
        </div>
      )}
      {tab === "documents" && (
        <Card>
          {docs.length === 0 ? <EmptyState title="Aucun document" /> : docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between border-b border-border px-5 py-3">
              <div><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.type} · {d.size}</p></div>
              <Button size="sm" variant="ghost" onClick={() => setDocToDelete(d.id)}>Supprimer</Button>
            </div>
          ))}
        </Card>
      )}
      {tab === "invoices" && <List items={invoices.map((i) => ({ id: i.id, href: `/factures/${i.id}`, title: i.number, subtitle: formatCurrency(invoiceBalance(state, i.id).totalTtc), badge: <InvoiceBadge status={invoiceBalance(state, i.id).status} /> }))} empty="Aucune facture" />}
      {tab === "payments" && <List items={payments.map((p) => ({ id: p.id, href: "/paiements", title: formatCurrency(p.amount), subtitle: `${p.paidAt} · ${p.method}`, badge: null }))} empty="Aucun paiement" />}
      {tab === "profit" && !isProvider && (
        <Card><CardContent className="space-y-3 p-5 text-sm">
          <p>Prix de vente (facturé) : <b>{formatCurrency(billed)}</b></p>
          <p>Coût prestataires : {formatCurrency(providerCost)}</p>
          <p>Coût produits : {formatCurrency(productCost)}</p>
          <p className="text-lg font-semibold">Marge estimée : {formatCurrency(billed - providerCost - productCost)}</p>
        </CardContent></Card>
      )}
      {tab === "history" && (
        <Card>
          <ol className="relative space-y-0 p-5">
            {timeline.map((a) => (
              <li key={a.id} className="relative border-l border-border pl-5 pb-5">
                <span className="absolute top-1.5 -left-1.5 size-3 rounded-full bg-teal-600" />
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)} {a.description ? `· ${a.description}` : ""}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {tab === "notes" && (
        <Card><CardContent className="space-y-3 pt-5">
          <textarea className="min-h-32 w-full rounded-lg border border-border p-3 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={() => { updateClient(client.id, { notes }); toast.success("Notes enregistrées"); }}>Enregistrer</Button>
        </CardContent></Card>
      )}
      <ConfirmDialog open={Boolean(docToDelete)} onClose={() => setDocToDelete(null)} title="Supprimer ce document ?" destructive confirmLabel="Supprimer" onConfirm={() => { if (docToDelete) deleteDocument(docToDelete); setDocToDelete(null); toast.success("Document supprimé"); }} />
    </>
  );
}

function List({ items, empty }: { empty: string; items: { id: string; href: string; title: string; subtitle: string; badge: React.ReactNode }[] }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <Card>
      {items.map((item) => (
        <Link key={item.id} to={item.href} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40">
          <div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.subtitle}</p></div>
          {item.badge}
        </Link>
      ))}
    </Card>
  );
}

