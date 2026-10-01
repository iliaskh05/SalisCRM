import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileDown, Plus, Printer, Send, Trash2 } from "lucide-react";
import { QuotePreview, printElement, type QuotePreviewModel } from "@/features/quotes/QuotePreview";
import { SendQuoteDialog } from "@/features/quotes/SendQuoteDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY } from "@/lib/company";
import { calculateQuote, type QuoteLineInput } from "@/lib/quotes/calculate";
import { QUOTE_WORKFLOW_LABELS, type QuoteWorkflowStatus } from "@/lib/quotes/labels";
import { quoteTotals, useDemoStore } from "@/lib/demo/store";
import { DEMO_TODAY } from "@/lib/demo/fixtures";
import { formatCurrency, formatDate } from "@/lib/format";
import { Kpi, PageTitle, QuoteBadge, TableWrap, Td } from "@/demo/ui";
import type { DemoQuoteLine } from "@/lib/demo/types";

export function DemoQuotesPage() {
  const { state } = useDemoStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [city, setCity] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const monthQuotes = state.quotes.filter((q) => q.issuedAt.startsWith("2026-09"));
  const monthValue = monthQuotes.reduce((s, q) => s + quoteTotals(state, q.id).totalTtc, 0);
  const pending = state.quotes.filter((q) => ["sent", "viewed", "pending", "ready"].includes(q.status));
  const accepted = state.quotes.filter((q) => ["accepted", "converted_intervention", "converted_invoice"].includes(q.status));
  const conversion = state.quotes.length ? Math.round((accepted.length / state.quotes.length) * 100) : 0;
  const avg = state.quotes.length ? monthValue / Math.max(monthQuotes.length, 1) : 0;

  const filtered = useMemo(() => {
    return state.quotes.filter((q) => {
      const client = state.clients.find((c) => c.id === q.clientId);
      const totals = quoteTotals(state, q.id);
      if (status && q.status !== status) return false;
      if (clientId && q.clientId !== clientId) return false;
      if (city && client?.city !== city) return false;
      if (from && q.issuedAt < from) return false;
      if (to && q.issuedAt > to) return false;
      if (minAmt && totals.totalTtc < Number(minAmt)) return false;
      if (maxAmt && totals.totalTtc > Number(maxAmt)) return false;
      const hay = `${q.reference} ${client?.name ?? ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [state, search, status, clientId, city, from, to, minAmt, maxAmt]);

  return (
    <>
      <PageTitle eyebrow="Commercial" title="Devis">
        <Button variant="accent" onClick={() => navigate("/devis/nouveau")}><Plus className="size-4" />Nouveau devis</Button>
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Devis ce mois" value={String(monthQuotes.length)} detail={formatCurrency(monthValue)} icon={FileDown} />
        <Kpi label="En attente" value={String(pending.length)} detail={`${accepted.length} acceptés`} icon={FileDown} tone="amber" />
        <Kpi label="Conversion" value={`${conversion} %`} detail={`Moyenne ${formatCurrency(avg)}`} icon={FileDown} tone="navy" />
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-4">
        <Input placeholder="Recherche" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(QUOTE_WORKFLOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Tous les clients</option>
          {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {[...new Set(state.clients.map((c) => c.city))].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input type="number" placeholder="Montant min TTC" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
        <Input type="number" placeholder="Montant max TTC" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
      </div>
      {filtered.length === 0 ? <EmptyState className="mt-6" title="Aucun devis" description="Créez un premier devis pour démarrer le cycle commercial." action={<Button onClick={() => navigate("/devis/nouveau")}>Créer un devis</Button>} /> : (
        <Card className="mt-4">
          <TableWrap headers={["Devis", "Client", "Ville", "Date", "Validité", "Montant TTC", "Statut"]}>
            {filtered.map((q) => {
              const client = state.clients.find((c) => c.id === q.clientId);
              return (
                <tr key={q.id} className="border-t border-border hover:bg-muted/40">
                  <Td><Link className="font-semibold hover:text-teal-700" to={`/devis/${q.id}`}>{q.reference}</Link></Td>
                  <Td>{client?.name}</Td>
                  <Td>{client?.city}</Td>
                  <Td>{formatDate(q.issuedAt)}</Td>
                  <Td>{formatDate(q.validUntil)}</Td>
                  <Td className="font-semibold">{formatCurrency(quoteTotals(state, q.id).totalTtc)}</Td>
                  <Td><QuoteBadge status={q.status} /></Td>
                </tr>
              );
            })}
          </TableWrap>
        </Card>
      )}
    </>
  );
}

type DraftLine = {
  catalogId: string | null;
  label: string;
  description: string;
  unit: string;
  quantity: string;
  unitPriceHt: string;
  vatRate: string;
  kind: DemoQuoteLine["kind"];
};

const emptyLine = (): DraftLine => ({ catalogId: null, label: "", description: "", unit: "forfait", quantity: "1", unitPriceHt: "0", vatRate: "20", kind: "manual" });
const DEFAULT_QUOTE_NOTES = "Prestation réalisée selon protocole Salis 3 Hottes. Rapport photo remis en fin d’intervention.";

export function DemoQuoteCreatePage() {
  const { state, saveQuote, createClient, createInstallation, prepareLeadForQuote, currentUser } = useDemoStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const leadId = params.get("lead");
  const leadPrepared = useRef(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [installationId, setInstallationId] = useState("");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newInstallOpen, setNewInstallOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", contact: "", phone: "", email: "", address: "", postalCode: "", city: "Paris", zone: "Paris" as const, siren: "", siret: "", businessType: "Restaurant", notes: "" });
  const [installForm, setInstallForm] = useState({ label: "Installation principale", hoodType: "", hoodLength: "", filterCount: 8, filterType: "Labyrinthe", ductPresent: true, ductLength: "", ductAccessibility: "", motorPresent: true, motorType: "", motorAccessibility: "", soilLevel: "Moyen", nightIntervention: false, schedulePreferences: "", remarks: "" });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [discount, setDiscount] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const [notes, setNotes] = useState(DEFAULT_QUOTE_NOTES);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(`${DEMO_TODAY}T00:00:00`);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (!leadId || leadPrepared.current) return;
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;
    leadPrepared.current = true;
    if (lead.quoteId) {
      navigate(`/devis/${lead.quoteId}`, { replace: true });
      return;
    }
    const prepared = prepareLeadForQuote(leadId);
    setClientId(prepared.clientId);
    setInstallationId(prepared.installationId);
    setLines([emptyLine()]);
    setStep(3);
    if (lead.note.trim()) {
      setNotes(`Message client : ${lead.note}\n\n${DEFAULT_QUOTE_NOTES}`);
    }
  }, [leadId, navigate, prepareLeadForQuote, state.leads]);

  const client = state.clients.find((c) => c.id === clientId);
  const installs = state.installations.filter((i) => i.clientId === clientId);
  const installation = state.installations.find((i) => i.id === installationId);

  const parsedLines: QuoteLineInput[] = lines.map((l) => ({
    label: l.label,
    description: l.description,
    unit: l.unit,
    quantity: Number(l.quantity),
    unitPriceHt: Number(l.unitPriceHt),
    vatRate: Number(l.vatRate),
  }));
  const totals = calculateQuote(parsedLines, { discountHt: Number(discount) || 0, depositAmount: Number(deposit) || 0 });

  const preview: QuotePreviewModel = {
    reference: "Aperçu",
    issuedAt: DEMO_TODAY,
    validUntil,
    notes,
    paymentTerms: state.settings.paymentTerms,
    client: client ? { name: client.name, contact: client.contact, address: client.address, postalCode: client.postalCode, city: client.city, siret: client.siret, email: client.email, phone: client.phone } : { name: "Client à sélectionner" },
    installation: installation ? { label: installation.label, address: client ? `${client.address}, ${client.postalCode} ${client.city}` : "", hood: `${installation.hoodType} ${installation.hoodLength}` } : null,
    lines: parsedLines.map((l, i) => ({ ...l, lineTotalHt: totals.lines[i]?.lineTotalHt ?? 0 })),
    totals,
  };

  function addCatalog(id: string) {
    const svc = state.catalog.find((s) => s.id === id);
    if (!svc) return;
    if (lines.some((l) => l.catalogId === id && l.label === svc.label)) {
      toast.message("Cette ligne est déjà présente. Ajustez la quantité plutôt que de dupliquer.");
    }
    setLines((prev) => [...prev.filter((l) => l.label), { catalogId: svc.id, label: svc.label, description: svc.description, unit: svc.unit, quantity: "1", unitPriceHt: String(svc.unitPriceHt), vatRate: String(svc.vatRate), kind: svc.kind }]);
  }

  function persist(status: QuoteWorkflowStatus) {
    if (!clientId) { toast.error("Sélectionnez un client"); setStep(1); return; }
    const clean = lines.filter((l) => l.label.trim() && Number(l.quantity) > 0);
    if (clean.length === 0) { toast.error("Ajoutez au moins une prestation"); setStep(3); return; }
    setBusy(true);
    const id = saveQuote(
      { clientId, installationId: installationId || null, commercialId: currentUser?.id ?? "u-sophie", status, issuedAt: DEMO_TODAY, validUntil, notes, paymentTerms: state.settings.paymentTerms, discountHt: Number(discount) || 0, depositAmount: Number(deposit) || 0, leadId: leadId || null },
      clean.map((l, i) => ({ catalogId: l.catalogId, label: l.label.trim(), description: l.description, unit: l.unit, quantity: Number(l.quantity), unitPriceHt: Number(l.unitPriceHt), vatRate: Number(l.vatRate), kind: l.kind, position: i })),
    );
    setBusy(false);
    toast.success(status === "draft" ? "Brouillon enregistré" : "Devis prêt");
    navigate(`/devis/${id}`);
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(leadId ? `/demandes-devis/${leadId}` : "/devis")}><ArrowLeft className="size-4" />{leadId ? "Retour à la demande" : "Retour"}</Button>
      <PageTitle eyebrow="Commercial" title="Nouveau devis" />
      {leadId ? (
        <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Client et installation repris depuis la demande. Ajoutez vous-même les prestations (catalogue ou ligne manuelle) — rien n’est généré automatiquement.
        </p>
      ) : null}
      <div className="mb-5 flex gap-2 text-xs font-semibold">
        {["Client", "Installation", "Prestations"].map((label, i) => (
          <button key={label} type="button" onClick={() => setStep(i + 1)} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-ink text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}. {label}</button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-4">
          {step === 1 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Client</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setNewClientOpen((v) => !v)}>Créer un client</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setInstallationId(""); }}>
                  <option value="">Sélectionner un client…</option>
                  {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
                </Select>
                {client ? (
                  <div className="rounded-xl bg-muted/60 p-4 text-sm">
                    <p className="font-semibold">{client.name}</p>
                    <p>{client.contact} · {client.phone}</p>
                    <p>{client.email}</p>
                    <p>{client.address}, {client.postalCode} {client.city}</p>
                    <p>SIREN {client.siren} · SIRET {client.siret}</p>
                    <p>{client.businessType}</p>
                  </div>
                ) : null}
                {newClientOpen ? (
                  <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                    <Input placeholder="Raison sociale" value={clientForm.name} onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input placeholder="Contact" value={clientForm.contact} onChange={(e) => setClientForm((f) => ({ ...f, contact: e.target.value }))} />
                    <Input placeholder="Téléphone" value={clientForm.phone} onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))} />
                    <Input placeholder="Email" value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} />
                    <Input className="sm:col-span-2" placeholder="Adresse" value={clientForm.address} onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))} />
                    <Button size="sm" onClick={() => {
                      if (!clientForm.name.trim()) { toast.error("Raison sociale obligatoire"); return; }
                      const id = createClient(clientForm);
                      setClientId(id);
                      setNewClientOpen(false);
                      toast.success("Client créé");
                    }}>Enregistrer le client</Button>
                  </div>
                ) : null}
                <Button variant="accent" onClick={() => setStep(2)} disabled={!clientId}>Continuer</Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Installation</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setNewInstallOpen((v) => !v)}>Nouvelle installation</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={installationId} onChange={(e) => setInstallationId(e.target.value)}>
                  <option value="">Sans installation (optionnel)</option>
                  {installs.map((i) => <option key={i.id} value={i.id}>{i.label} — {i.hoodType}</option>)}
                </Select>
                {installation ? (
                  <div className="grid gap-1 rounded-xl bg-muted/60 p-4 text-sm">
                    <p>{installation.hoodType} · {installation.hoodLength} · {installation.filterCount} {installation.filterType}</p>
                    <p>Conduit : {installation.ductPresent ? `${installation.ductLength} · ${installation.ductAccessibility}` : "non"}</p>
                    <p>Moteur : {installation.motorPresent ? `${installation.motorType} · ${installation.motorAccessibility}` : "non"}</p>
                    <p>Encrassement {installation.soilLevel} · Nuit {installation.nightIntervention ? "oui" : "non"}</p>
                    <p>{installation.schedulePreferences}</p>
                    <p>{installation.remarks}</p>
                  </div>
                ) : null}
                {newInstallOpen ? (
                  <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                    <Input placeholder="Libellé" value={installForm.label} onChange={(e) => setInstallForm((f) => ({ ...f, label: e.target.value }))} />
                    <Input placeholder="Type de hotte" value={installForm.hoodType} onChange={(e) => setInstallForm((f) => ({ ...f, hoodType: e.target.value }))} />
                    <Input placeholder="Longueur" value={installForm.hoodLength} onChange={(e) => setInstallForm((f) => ({ ...f, hoodLength: e.target.value }))} />
                    <Input placeholder="Type filtres" value={installForm.filterType} onChange={(e) => setInstallForm((f) => ({ ...f, filterType: e.target.value }))} />
                    <Button size="sm" className="sm:col-span-2" onClick={() => {
                      if (!clientId) return;
                      const id = createInstallation({ ...installForm, clientId });
                      setInstallationId(id);
                      setNewInstallOpen(false);
                      toast.success("Installation créée");
                    }}>Enregistrer l’installation</Button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
                  <Button variant="accent" onClick={() => setStep(3)}>Continuer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader><CardTitle>Prestations & conditions</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Catalogue</Label>
                  <Select value="" onChange={(e) => e.target.value && addCatalog(e.target.value)}>
                    <option value="">Ajouter une prestation du catalogue…</option>
                    {state.catalog.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.unitPriceHt} € HT / {s.unit}</option>)}
                  </Select>
                </div>
                {lines.map((line, idx) => (
                  <div key={idx} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-8">
                    <Input className="sm:col-span-3" placeholder="Libellé" value={line.label} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, label: e.target.value } : l))} />
                    <Input placeholder="Qté" type="number" min={0} value={line.quantity} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} />
                    <Input placeholder="Unité" value={line.unit} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, unit: e.target.value } : l))} />
                    <Input placeholder="PU HT" type="number" min={0} value={line.unitPriceHt} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, unitPriceHt: e.target.value } : l))} />
                    <Input placeholder="TVA" type="number" min={0} value={line.vatRate} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, vatRate: e.target.value } : l))} />
                    <div className="flex items-center justify-between sm:col-span-8">
                      <Input placeholder="Description" value={line.description} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} />
                      <Button variant="ghost" size="sm" onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setLines((p) => [...p, emptyLine()])}>Ligne manuelle</Button>
                  <Button size="sm" variant="outline" onClick={() => addCatalog("svc-09")}>Déplacement</Button>
                  <Button size="sm" variant="outline" onClick={() => addCatalog("svc-10")}>Majoration nuit</Button>
                  <Button size="sm" variant="outline" onClick={() => addCatalog("svc-11")}>Urgence</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Remise HT</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
                  <div><Label>Acompte TTC</Label><Input type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
                  <div><Label>Validité</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
                </div>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
                  <Button disabled={busy} onClick={() => persist("draft")}>Enregistrer brouillon</Button>
                  <Button variant="accent" disabled={busy} onClick={() => persist("ready")}>Enregistrer et prévisualiser</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="print-area">
          <QuotePreview model={preview} />
        </div>
      </div>
    </div>
  );
}

export function DemoQuoteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state, setQuoteStatus, duplicateQuote, deleteQuote, convertQuoteToIntervention, createInvoiceFrom } = useDemoStore();
  const quote = state.quotes.find((q) => q.id === id);
  const [confirmDelete, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  if (!quote) return <EmptyState title="Devis introuvable" />;

  const client = state.clients.find((c) => c.id === quote.clientId);
  const installation = state.installations.find((i) => i.id === quote.installationId);
  const lines = state.quoteLines.filter((l) => l.quoteId === quote.id).sort((a, b) => a.position - b.position);
  const totals = quoteTotals(state, quote.id);
  const accepted = ["accepted", "converted_intervention", "converted_invoice"].includes(quote.status);

  const model: QuotePreviewModel = {
    reference: quote.reference,
    issuedAt: quote.issuedAt,
    validUntil: quote.validUntil,
    notes: quote.notes,
    paymentTerms: quote.paymentTerms,
    client: client ? { name: client.name, contact: client.contact, address: client.address, postalCode: client.postalCode, city: client.city, siret: client.siret, email: client.email, phone: client.phone } : { name: "—" },
    installation: installation ? { label: installation.label, address: client ? `${client.address}, ${client.postalCode} ${client.city}` : "", hood: `${installation.hoodType} ${installation.hoodLength}` } : null,
    lines: lines.map((l, i) => ({ label: l.label, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceHt: l.unitPriceHt, vatRate: l.vatRate, lineTotalHt: totals.lines[i]?.lineTotalHt ?? 0 })),
    totals,
  };

  function act(status: QuoteWorkflowStatus, message: string) {
    setBusy(true);
    setQuoteStatus(quote!.id, status);
    setBusy(false);
    toast.success(message);
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="no-print mb-3" onClick={() => navigate("/devis")}><ArrowLeft className="size-4" />Retour</Button>
      <div className="no-print mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">Devis</p>
          <h1 className="font-serif text-3xl font-semibold">{quote.reference}</h1>
          <p className="text-sm text-muted-foreground">{client?.name} · {formatDate(quote.issuedAt)}</p>
        </div>
        <QuoteBadge status={quote.status} />
      </div>
      <div className="no-print mb-5 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => printElement(quote.reference)}><Printer className="size-4" />Aperçu / Imprimer</Button>
        <Button size="sm" variant="outline" onClick={() => { printElement(quote.reference); toast.success("Utilisez « Enregistrer au format PDF » dans la boîte d’impression."); }}><FileDown className="size-4" />Télécharger PDF</Button>
        <Button size="sm" variant="outline" onClick={() => { const nid = duplicateQuote(quote.id); toast.success("Devis dupliqué"); navigate(`/devis/${nid}`); }}><Copy className="size-4" />Dupliquer</Button>
        {quote.status === "draft" ? <Button size="sm" onClick={() => act("ready", "Devis prêt à envoyer")}>Prêt à envoyer</Button> : null}
        {["draft", "ready"].includes(quote.status) ? (
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="size-4" />
            Envoyer le devis
          </Button>
        ) : null}
        {["sent", "viewed", "pending"].includes(quote.status) ? <Button size="sm" onClick={() => act("viewed", "Marqué comme consulté")}>Consulté</Button> : null}
        {!accepted && quote.status !== "rejected" ? <Button size="sm" variant="accent" disabled={busy} onClick={() => act("accepted", "Devis accepté")}>Marquer accepté</Button> : null}
        {!accepted ? <Button size="sm" variant="outline" onClick={() => act("rejected", "Devis refusé")}>Refuser</Button> : null}
        {accepted && !quote.interventionId ? <Button size="sm" variant="accent" onClick={() => { const iid = convertQuoteToIntervention(quote.id); toast.success("Intervention créée"); navigate(`/interventions/${iid}`); }}>Créer l’intervention</Button> : null}
        {quote.interventionId ? <Button size="sm" variant="outline" onClick={() => navigate(`/interventions/${quote.interventionId}`)}>Ouvrir l’intervention</Button> : null}
        {accepted && !quote.invoiceId ? <Button size="sm" onClick={() => { const iid = createInvoiceFrom({ quoteId: quote.id, clientId: quote.clientId }); toast.success("Facture créée"); navigate(`/factures/${iid}`); }}>Convertir en facture</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}><Trash2 className="size-4" />Supprimer</Button>
      </div>
      {accepted && !quote.interventionId ? (
        <div className="no-print mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Devis accepté. Prochaine étape : créer l’intervention préremplie (client, installation, prestations, prix, notes).
        </div>
      ) : null}
      <div className="print-area">
        <QuotePreview model={model} />
      </div>
      <p className="no-print mt-4 text-xs text-muted-foreground">Envoi e-mail : {COMPANY.email} — statut « prêt à connecter », aucune transmission réelle.</p>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirm(false)} title="Supprimer ce devis ?" destructive confirmLabel="Supprimer" onConfirm={() => { deleteQuote(quote.id); toast.success("Devis supprimé"); navigate("/devis"); }} />
      <SendQuoteDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        to={client?.email ?? ""}
        clientName={client?.name ?? "Client"}
        reference={quote.reference}
        validUntil={quote.validUntil}
        onConfirm={() => act("sent", "Devis marqué envoyé dans le CRM")}
      />
    </div>
  );
}
