import { useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Camera, MapPin, Navigation, Phone, Plus, Trash2, Upload } from "lucide-react";
import { BeforeAfterSlider } from "@/components/media/BeforeAfterSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { estimatedMargin, productCost } from "@/lib/quotes/calculate";
import { INTERVENTION_WORKFLOW_LABELS, type InterventionWorkflowStatus } from "@/lib/quotes/labels";
import { useDemoStore } from "@/lib/demo/store";
import { formatCurrency } from "@/lib/format";
import { InterventionBadge, PageTitle, TableWrap, Td } from "@/demo/ui";

export function DemoInterventionsPage() {
  const { state, isProvider, currentUser } = useDemoStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const provider = state.providers.find((p) => p.userId === currentUser?.id);
  const list = state.interventions.filter((i) => {
    if (isProvider && provider && i.providerId !== provider.id) return false;
    if (status && i.status !== status) return false;
    if (city && i.city !== city) return false;
    const client = state.clients.find((c) => c.id === i.clientId);
    return `${i.reference} ${client?.name} ${i.city} ${i.service}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <PageTitle eyebrow="Opérations" title={isProvider ? "Mes interventions" : "Interventions"}>
        {!isProvider ? <Button variant="accent" onClick={() => navigate("/interventions/nouvelle")}><Plus className="size-4" />Nouvelle intervention</Button> : null}
      </PageTitle>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <Input placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(INTERVENTION_WORKFLOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Toutes les villes</option>
          {[...new Set(state.interventions.map((i) => i.city))].map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <EmptyState title="Aucune intervention planifiée" /> : (
        <Card>
          <TableWrap headers={["Réf.", "Client", "Ville", "Date", "Prestataire", "Statut", "Montant"]}>
            {list.map((i) => (
              <tr key={i.id} className="border-t border-border hover:bg-muted/40">
                <Td><Link className="font-semibold hover:text-teal-700" to={`/interventions/${i.id}`}>{i.reference}</Link></Td>
                <Td>{state.clients.find((c) => c.id === i.clientId)?.name}</Td>
                <Td>{i.city}</Td>
                <Td>{i.date} {i.startTime}</Td>
                <Td>{state.providers.find((p) => p.id === i.providerId)?.name ?? "—"}</Td>
                <Td><InterventionBadge status={i.status} /></Td>
                <Td>{formatCurrency(i.amountTtc)}</Td>
              </tr>
            ))}
          </TableWrap>
        </Card>
      )}
    </>
  );
}

export function DemoInterventionCreatePage() {
  const { state, convertQuoteToIntervention } = useDemoStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = params.get("quote") ?? "";
  const clientId = params.get("client") ?? "";
  const quotes = state.quotes.filter((q) => ["accepted", "converted_intervention"].includes(q.status) && (!clientId || q.clientId === clientId));

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Opérations" title="Nouvelle intervention" />
      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm text-muted-foreground">Pour rester cohérent, une intervention se crée de préférence depuis un devis accepté.</p>
          <Select defaultValue={quoteId} id="quote-select">
            <option value="">Choisir un devis accepté…</option>
            {quotes.map((q) => <option key={q.id} value={q.id}>{q.reference} — {state.clients.find((c) => c.id === q.clientId)?.name}</option>)}
          </Select>
          <Button variant="accent" onClick={() => {
            const sel = (document.getElementById("quote-select") as HTMLSelectElement | null)?.value || quoteId;
            if (!sel) { toast.error("Sélectionnez un devis"); return; }
            const id = convertQuoteToIntervention(sel);
            toast.success("Intervention créée");
            navigate(`/interventions/${id}`);
          }}>Créer depuis le devis</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DemoInterventionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state, updateIntervention, addPhoto, deletePhoto, upsertProduct, deleteProduct, createInvoiceFrom, ensureInterventionChat, isProvider, currentUser } = useDemoStore();
  const item = state.interventions.find((i) => i.id === id);
  const [confirmCancel, setConfirm] = useState(false);
  const [photoKind, setPhotoKind] = useState<"before" | "after" | "technical">("before");
  const [comment, setComment] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [product, setProduct] = useState({ name: "Dégraissant", category: "Dégraissant", quantity: "1", unit: "L", unitCost: "8.40", notes: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  if (!item) return <EmptyState title="Intervention introuvable" />;

  const client = state.clients.find((c) => c.id === item.clientId);
  const provider = state.providers.find((p) => p.id === item.providerId);
  const photos = state.photos.filter((p) => p.interventionId === item.id);
  const products = state.products.filter((p) => p.interventionId === item.id);
  const before = photos.find((p) => p.kind === "before");
  const after = photos.find((p) => p.kind === "after");
  const prodCost = products.reduce((s, p) => s + productCost(p.quantity, p.unitCost), 0);
  const margin = estimatedMargin({ sellingPriceTtc: item.amountTtc, providerCost: provider?.costRate ?? 0, productCost: prodCost });

  async function onFiles(files: FileList | null) {
    if (!files?.[0] || !item) return;
    setProgress(15);
    try {
      const url = await readFile(files[0]);
      setProgress(80);
      addPhoto({ interventionId: item.id, clientId: item.clientId, kind: photoKind, url, comment, uploader: currentUser?.name ?? "Utilisateur" });
      setProgress(100);
      toast.success("Photo ajoutée");
      setComment("");
    } catch {
      toast.error("Échec du chargement — réessayez");
    } finally {
      setTimeout(() => setProgress(null), 400);
    }
  }

  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`;

  return (
    <>
      <Link to="/interventions" className="text-sm font-medium text-teal-700">← Interventions</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-teal-700 uppercase">{item.reference}</p>
          <h1 className="font-serif text-3xl font-semibold">{client?.name}</h1>
          <p className="text-muted-foreground">{item.address}</p>
        </div>
        <InterventionBadge status={item.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 md:hidden">
        <Button size="sm" onClick={() => window.open(`tel:${client?.phone}`)}><Phone className="size-4" />Appeler</Button>
        <Button size="sm" onClick={() => window.open(maps, "_blank")}><Navigation className="size-4" />Itinéraire</Button>
      </div>

      <ol className="mt-5 grid gap-2 rounded-xl border border-border bg-card p-4 text-sm md:hidden">
        {["Démarrer", "Photos avant", "Travail", "Produits", "Photos après", "Rapport", "Signature", "Terminer"].map((s, i) => (
          <li key={s} className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold">{i + 1}</span>{s}</li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Mission</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div><Label>Date</Label><Input type="date" value={item.date} onChange={(e) => updateIntervention(item.id, { date: e.target.value, status: e.target.value ? "planned" : item.status })} /></div>
            <div><Label>Début</Label><Input type="time" value={item.startTime} onChange={(e) => updateIntervention(item.id, { startTime: e.target.value })} /></div>
            <div><Label>Fin</Label><Input type="time" value={item.endTime} onChange={(e) => updateIntervention(item.id, { endTime: e.target.value })} /></div>
            {!isProvider ? (
              <div className="sm:col-span-2">
                <Label>Prestataire</Label>
                <Select value={item.providerId ?? ""} onChange={(e) => {
                  const res = updateIntervention(item.id, { providerId: e.target.value, status: item.date ? "planned" : "to_plan" });
                  if (res.conflict) toast.error(res.conflict);
                  else toast.success("Prestataire assigné");
                }}>
                  <option value="">—</option>
                  {state.providers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.zone}</option>)}
                </Select>
              </div>
            ) : null}
            <div className="sm:col-span-2"><Label>Statut</Label>
              <Select value={item.status} onChange={(e) => {
                const res = updateIntervention(item.id, { status: e.target.value as InterventionWorkflowStatus });
                if (res.conflict) toast.error(res.conflict);
              }}>
                {Object.entries(INTERVENTION_WORKFLOW_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <p className="sm:col-span-2 text-muted-foreground">{item.description}</p>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button size="sm" onClick={() => updateIntervention(item.id, { status: "started" })}>Démarrer</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(maps, "_blank")}><MapPin className="size-4" />Navigation</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/chat?c=${ensureInterventionChat(item.id)}`)}>Discussion interne</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/interventions/${item.id}/report`)}>Rapport</Button>
              {!isProvider && ["completed", "report_validated"].includes(item.status) && !item.invoiceId ? (
                <Button size="sm" variant="accent" onClick={() => { const iid = createInvoiceFrom({ interventionId: item.id, clientId: item.clientId, quoteId: item.quoteId ?? undefined }); toast.success("Facture générée"); navigate(`/factures/${iid}`); }}>Générer la facture</Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Annuler l’intervention</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Photos avant / après / technique</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={photoKind} onChange={(e) => setPhotoKind(e.target.value as typeof photoKind)}>
                <option value="before">Avant</option>
                <option value="after">Après</option>
                <option value="technical">Technique</option>
              </Select>
              <Input placeholder="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            <div className="flex gap-2">
              <Button size="sm" variant="accent" onClick={() => fileRef.current?.click()}><Camera className="size-4" />Prendre / importer</Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" />Depuis l’appareil</Button>
            </div>
            {progress != null ? <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-teal-600" style={{ width: `${progress}%` }} /></div> : null}
            {before && after ? <BeforeAfterSlider beforeSrc={before.url} afterSrc={after.url} /> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {photos.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-lg border">
                  <img src={p.url} alt={p.comment} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between p-2 text-xs">
                    <span>{p.kind}</span>
                    <button type="button" onClick={() => deletePhoto(p.id)}><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            {photos.length === 0 ? <EmptyState title="Aucune photo" className="py-8" /> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Produits utilisés</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-6">
            <Input placeholder="Produit" value={product.name} onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Catégorie" value={product.category} onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))} />
            <Input type="number" placeholder="Qté" value={product.quantity} onChange={(e) => setProduct((p) => ({ ...p, quantity: e.target.value }))} />
            <Input placeholder="Unité" value={product.unit} onChange={(e) => setProduct((p) => ({ ...p, unit: e.target.value }))} />
            <Input type="number" placeholder="Coût unit." value={product.unitCost} onChange={(e) => setProduct((p) => ({ ...p, unitCost: e.target.value }))} />
            <Button onClick={() => { upsertProduct({ interventionId: item.id, name: product.name, category: product.category, quantity: Number(product.quantity), unit: product.unit, unitCost: Number(product.unitCost), notes: product.notes }); toast.success("Produit ajouté"); }}>Ajouter</Button>
          </div>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name} · {p.quantity} {p.unit}</span>
              <span className="flex items-center gap-3">{formatCurrency(productCost(p.quantity, p.unitCost))}<button type="button" onClick={() => deleteProduct(p.id)}><Trash2 className="size-3.5" /></button></span>
            </div>
          ))}
        </CardContent>
      </Card>

      {!isProvider ? (
        <Card className="mt-4">
          <CardHeader><CardTitle>Rentabilité estimée</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-4">
            <p>Prix de vente TTC<br /><b>{formatCurrency(item.amountTtc)}</b></p>
            <p>Coût prestataire<br />{formatCurrency(provider?.costRate)}</p>
            <p>Coût produits<br />{formatCurrency(prodCost)}</p>
            <p>Marge<br /><b>{formatCurrency(margin.margin)}</b> ({margin.marginRate} %)</p>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog open={confirmCancel} onClose={() => setConfirm(false)} title="Annuler cette intervention ?" destructive confirmLabel="Annuler l’intervention" onConfirm={() => { updateIntervention(item.id, { status: "cancelled" }); toast.success("Intervention annulée"); setConfirm(false); }} />
    </>
  );
}

export function DemoReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state, saveReport, currentUser } = useDemoStore();
  const item = state.interventions.find((i) => i.id === id);
  const existing = state.reports.find((r) => r.interventionId === id);
  const [form, setForm] = useState({
    workCompleted: existing?.workCompleted ?? "",
    observations: existing?.observations ?? "",
    difficulties: existing?.difficulties ?? "",
    recommendations: existing?.recommendations ?? "",
    checklist: existing?.checklist ?? { hood: false, filters: false, ducts: false, motor: false, grease: false, access: false, area: false },
    providerSignature: existing?.providerSignature ?? currentUser?.name ?? "",
    clientSignature: existing?.clientSignature ?? "",
  });
  if (!item) return <EmptyState title="Intervention introuvable" />;
  const client = state.clients.find((c) => c.id === item.clientId);
  const photos = state.photos.filter((p) => p.interventionId === item.id);
  const before = photos.find((p) => p.kind === "before");
  const after = photos.find((p) => p.kind === "after");

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/interventions/${id}`)}>← Intervention</Button>
      <PageTitle eyebrow="Rapport" title={item.reference} />
      <Card className="mb-4"><CardContent className="grid gap-2 pt-5 text-sm sm:grid-cols-2">
        <p>Client : {client?.name}</p>
        <p>Site : {item.address}</p>
        <p>Date : {item.date} · {item.startTime}–{item.endTime}</p>
        <p>Prestataire : {state.providers.find((p) => p.id === item.providerId)?.name}</p>
      </CardContent></Card>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Label>Travail réalisé</Label>
          <Textarea value={form.workCompleted} onChange={(e) => setForm((f) => ({ ...f, workCompleted: e.target.value }))} />
          <Label>Observations</Label>
          <Textarea value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} />
          <Label>Difficultés</Label>
          <Textarea value={form.difficulties} onChange={(e) => setForm((f) => ({ ...f, difficulties: e.target.value }))} />
          <Label>Recommandations</Label>
          <Textarea value={form.recommendations} onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))} />
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries({ hood: "Hotte nettoyée", filters: "Filtres nettoyés", ducts: "Conduits nettoyés", motor: "Moteur contrôlé", grease: "Graisse retirée", access: "Accès vérifié", area: "Zone de travail nettoyée" }).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(form.checklist[k])} onChange={(e) => setForm((f) => ({ ...f, checklist: { ...f.checklist, [k]: e.target.checked } }))} />
                {label}
              </label>
            ))}
          </div>
          {before && after ? <BeforeAfterSlider beforeSrc={before.url} afterSrc={after.url} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Signature prestataire</Label><Input value={form.providerSignature} onChange={(e) => setForm((f) => ({ ...f, providerSignature: e.target.value }))} /></div>
            <div><Label>Signature client</Label><Input value={form.clientSignature} onChange={(e) => setForm((f) => ({ ...f, clientSignature: e.target.value }))} /></div>
          </div>
          <Button variant="accent" onClick={() => {
            saveReport({
              interventionId: item.id,
              workCompleted: form.workCompleted,
              observations: form.observations,
              difficulties: form.difficulties,
              recommendations: form.recommendations,
              checklist: form.checklist,
              providerSignature: form.providerSignature || null,
              clientSignature: form.clientSignature || null,
              validatedAt: form.providerSignature && form.clientSignature ? new Date().toISOString() : null,
            });
            toast.success(form.clientSignature ? "Rapport validé" : "Rapport enregistré");
            navigate(`/interventions/${id}`);
          }}>Enregistrer / valider</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

