import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FilePlus2, Receipt, Upload, Wallet, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ClientStatusBadge,
  InterventionStatusBadge,
  InvoiceStatusBadge,
  QuoteStatusBadge,
} from "@/components/ui/status-badge";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import {
  ACTIVITY_TYPE_LABELS,
  CLIENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  PHOTO_KIND_LABELS,
  STORAGE_BUCKETS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, nullIfEmpty } from "@/lib/format";
import type {
  ClientStatus,
  DocumentType,
  Tables,
} from "@/lib/supabase/types";
import { isAdmin } from "@/lib/auth/permissions";

const TABS = [
  { id: "general", label: "Vue générale" },
  { id: "installation", label: "Installation" },
  { id: "interventions", label: "Interventions" },
  { id: "photos", label: "Photos" },
  { id: "devis", label: "Devis" },
  { id: "factures", label: "Factures" },
  { id: "paiements", label: "Paiements" },
  { id: "documents", label: "Documents" },
  { id: "historique", label: "Historique" },
];

async function fetchClientBundle(id: string) {
  const [
    clientRes,
    installRes,
    interventionsRes,
    photosRes,
    quotesRes,
    invoicesRes,
    paymentsRes,
    documentsRes,
    activitiesRes,
    financialRes,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("client_installations").select("*").eq("client_id", id).order("created_at"),
    supabase
      .from("interventions")
      .select("*")
      .eq("client_id", id)
      .order("scheduled_date", { ascending: false }),
    supabase
      .from("intervention_photos")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("invoice_balances").select("*").eq("client_id", id),
    supabase.from("payments").select("*").eq("client_id", id).order("paid_at", { ascending: false }),
    supabase.from("documents").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("client_financial_summary").select("*").eq("client_id", id).maybeSingle(),
  ]);

  if (clientRes.error) throw clientRes.error;

  return {
    client: clientRes.data as Tables<"clients">,
    installations: (installRes.data ?? []) as Tables<"client_installations">[],
    interventions: (interventionsRes.data ?? []) as Tables<"interventions">[],
    photos: (photosRes.data ?? []) as Tables<"intervention_photos">[],
    quotes: (quotesRes.data ?? []) as Tables<"quotes">[],
    invoices: invoicesRes.data ?? [],
    payments: (paymentsRes.data ?? []) as Tables<"payments">[],
    documents: (documentsRes.data ?? []) as Tables<"documents">[],
    activities: (activitiesRes.data ?? []) as Tables<"activities">[],
    financial: financialRes.data,
  };
}

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "general";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClientBundle(id),
    enabled: Boolean(id),
  });

  const setTab = (next: string) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p);
  };

  if (isLoading) return <LoadingState />;
  if (error || !data) return <EmptyState title="Client introuvable" description={String(error ?? "")} />;

  const { client } = data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/clients")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={client.company_name}
        description={`${client.reference ?? client.id.slice(0, 8)} · ${client.city || "Sans ville"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ClientStatusBadge status={client.status} />
            <RoleGate permission="quotes:write">
              <Button variant="outline" size="sm" onClick={() => navigate(`/devis/nouveau?client=${client.id}`)}>
                <FilePlus2 className="size-3.5" />
                Devis
              </Button>
            </RoleGate>
            <RoleGate permission="interventions:write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/interventions/nouvelle?client=${client.id}`)}
              >
                <Wrench className="size-3.5" />
                Intervention
              </Button>
            </RoleGate>
            <RoleGate permission="invoices:write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/factures/nouvelle?client=${client.id}`)}
              >
                <Receipt className="size-3.5" />
                Facture
              </Button>
            </RoleGate>
            <RoleGate permission="payments:write">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/paiements/nouveau?client=${client.id}`)}
              >
                <Wallet className="size-3.5" />
                Paiement
              </Button>
            </RoleGate>
          </div>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === "general" && (
        <GeneralTab
          client={client}
          financial={data.financial}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["client", id] });
            await qc.invalidateQueries({ queryKey: ["clients"] });
            await qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}
      {tab === "installation" && (
        <InstallationTab
          clientId={client.id}
          installations={data.installations}
          onSaved={() => qc.invalidateQueries({ queryKey: ["client", id] })}
        />
      )}
      {tab === "interventions" && (
        <ListTab
          empty="Aucune intervention"
          items={data.interventions.map((i) => ({
            id: i.id,
            href: `/interventions/${i.id}`,
            title: i.reference ?? i.service_type ?? "Intervention",
            subtitle: formatDate(i.scheduled_date),
            badge: <InterventionStatusBadge status={i.status} />,
          }))}
        />
      )}
      {tab === "photos" && (
        <PhotosTab photos={data.photos} canDelete={isAdmin(role)} onChanged={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      )}
      {tab === "devis" && (
        <ListTab
          empty="Aucun devis"
          items={data.quotes.map((q) => ({
            id: q.id,
            href: `/devis/${q.id}`,
            title: q.reference ?? "Devis",
            subtitle: formatCurrency(q.total_ttc),
            badge: <QuoteStatusBadge status={q.status} />,
          }))}
        />
      )}
      {tab === "factures" && (
        <ListTab
          empty="Aucune facture"
          items={data.invoices.map((inv) => ({
            id: inv.invoice_id!,
            href: `/factures/${inv.invoice_id}`,
            title: inv.number ?? "Facture",
            subtitle: `TTC ${formatCurrency(inv.total_ttc)} · Dû ${formatCurrency(inv.amount_due)}`,
            badge: inv.status ? <InvoiceStatusBadge status={inv.status} /> : null,
          }))}
        />
      )}
      {tab === "paiements" && (
        <ListTab
          empty="Aucun paiement"
          items={data.payments.map((p) => ({
            id: p.id,
            href: `/paiements`,
            title: formatCurrency(p.amount),
            subtitle: `${formatDate(p.paid_at)} · ${p.method}`,
            badge: null,
          }))}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          clientId={client.id}
          documents={data.documents}
          userId={user?.id}
          onChanged={() => qc.invalidateQueries({ queryKey: ["client", id] })}
        />
      )}
      {tab === "historique" && (
        <Card>
          <CardContent className="p-0">
            {data.activities.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Aucune activité" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.activities.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[a.activity_type]}
                        {a.description ? ` — ${a.description}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GeneralTab({
  client,
  financial,
  onSaved,
}: {
  client: Tables<"clients">;
  financial: {
    total_invoiced: number;
    total_paid: number;
    amount_due: number;
    last_intervention_at: string | null;
    next_intervention_at: string | null;
  } | null;
  onSaved: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    company_name: client.company_name,
    contact_name: client.contact_name ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    postal_code: client.postal_code ?? "",
    siret: client.siret ?? "",
    business_type: client.business_type ?? "",
    notes: client.notes ?? "",
    next_action: client.next_action ?? "",
    next_action_date: client.next_action_date?.slice(0, 10) ?? "",
    status: client.status,
  });

  useEffect(() => {
    setForm({
      company_name: client.company_name,
      contact_name: client.contact_name ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      postal_code: client.postal_code ?? "",
      siret: client.siret ?? "",
      business_type: client.business_type ?? "",
      notes: client.notes ?? "",
      next_action: client.next_action ?? "",
      next_action_date: client.next_action_date?.slice(0, 10) ?? "",
      status: client.status,
    });
  }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({
          company_name: form.company_name,
          contact_name: nullIfEmpty(form.contact_name),
          phone: nullIfEmpty(form.phone),
          email: nullIfEmpty(form.email),
          address: nullIfEmpty(form.address),
          city: nullIfEmpty(form.city),
          postal_code: nullIfEmpty(form.postal_code),
          siret: nullIfEmpty(form.siret),
          business_type: nullIfEmpty(form.business_type),
          notes: nullIfEmpty(form.notes),
          next_action: nullIfEmpty(form.next_action),
          next_action_date: nullIfEmpty(form.next_action_date),
          status: form.status,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", client.id);
      if (error) throw error;
      if (form.status !== client.status) {
        await logActivity({
          activity_type: "STATUS_CHANGED",
          title: `Statut client : ${CLIENT_STATUS_LABELS[client.status]} → ${CLIENT_STATUS_LABELS[form.status]}`,
          client_id: client.id,
          created_by: user?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Dossier enregistré");
      await onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleGate permission="clients:write" fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <Field label="Raison sociale" className="sm:col-span-2">
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Contact">
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="SIRET">
                <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} />
              </Field>
              <Field label="Adresse" className="sm:col-span-2">
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </Field>
              <Field label="CP">
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                />
              </Field>
              <Field label="Ville">
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </Field>
              <Field label="Activité">
                <Input
                  value={form.business_type}
                  onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                />
              </Field>
              <Field label="Statut">
                <Select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))}
                >
                  {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CLIENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prochaine action">
                <Input
                  value={form.next_action}
                  onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
                />
              </Field>
              <Field label="Date action">
                <Input
                  type="date"
                  value={form.next_action_date}
                  onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={save.isPending}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </RoleGate>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Synthèse financière</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Metric label="Facturé" value={formatCurrency(financial?.total_invoiced)} />
          <Metric label="Encaissé" value={formatCurrency(financial?.total_paid)} />
          <Metric label="Reste dû" value={formatCurrency(financial?.amount_due)} />
          <Metric label="Dernière intervention" value={formatDate(financial?.last_intervention_at)} />
          <Metric label="Prochaine intervention" value={formatDate(financial?.next_intervention_at)} />
        </CardContent>
      </Card>
    </div>
  );
}

function InstallationTab({
  clientId,
  installations,
  onSaved,
}: {
  clientId: string;
  installations: Tables<"client_installations">[];
  onSaved: () => void;
}) {
  const current = installations[0];
  const [form, setForm] = useState({
    label: current?.label ?? "Installation principale",
    hood_length: current?.hood_length ?? "",
    hood_type: current?.hood_type ?? "",
    filter_count: current?.filter_count?.toString() ?? "",
    filter_type: current?.filter_type ?? "",
    duct_present: current?.duct_present ?? false,
    duct_length: current?.duct_length ?? "",
    duct_accessibility: current?.duct_accessibility ?? "",
    motor_present: current?.motor_present ?? false,
    motor_type: current?.motor_type ?? "",
    motor_accessibility: current?.motor_accessibility ?? "",
    night_intervention: current?.night_intervention ?? false,
    schedule_preference: current?.schedule_preference ?? "",
    soil_level: current?.soil_level ?? "",
    remarks: current?.remarks ?? "",
  });

  useEffect(() => {
    const c = installations[0];
    setForm({
      label: c?.label ?? "Installation principale",
      hood_length: c?.hood_length ?? "",
      hood_type: c?.hood_type ?? "",
      filter_count: c?.filter_count?.toString() ?? "",
      filter_type: c?.filter_type ?? "",
      duct_present: c?.duct_present ?? false,
      duct_length: c?.duct_length ?? "",
      duct_accessibility: c?.duct_accessibility ?? "",
      motor_present: c?.motor_present ?? false,
      motor_type: c?.motor_type ?? "",
      motor_accessibility: c?.motor_accessibility ?? "",
      night_intervention: c?.night_intervention ?? false,
      schedule_preference: c?.schedule_preference ?? "",
      soil_level: c?.soil_level ?? "",
      remarks: c?.remarks ?? "",
    });
  }, [installations]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        label: nullIfEmpty(form.label),
        hood_length: nullIfEmpty(form.hood_length),
        hood_type: nullIfEmpty(form.hood_type),
        filter_count: form.filter_count === "" ? null : Number(form.filter_count),
        filter_type: nullIfEmpty(form.filter_type),
        duct_present: form.duct_present,
        duct_length: nullIfEmpty(form.duct_length),
        duct_accessibility: nullIfEmpty(form.duct_accessibility),
        motor_present: form.motor_present,
        motor_type: nullIfEmpty(form.motor_type),
        motor_accessibility: nullIfEmpty(form.motor_accessibility),
        night_intervention: form.night_intervention,
        schedule_preference: nullIfEmpty(form.schedule_preference),
        soil_level: nullIfEmpty(form.soil_level),
        remarks: nullIfEmpty(form.remarks),
        updated_at: new Date().toISOString(),
      };
      if (current) {
        const { error } = await supabase
          .from("client_installations")
          .update(payload as never)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_installations").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Installation enregistrée");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation technique</CardTitle>
      </CardHeader>
      <CardContent>
        <RoleGate permission="installations:write" fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Libellé" className="sm:col-span-2">
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </Field>
            <Field label="Longueur hotte">
              <Input
                value={form.hood_length}
                onChange={(e) => setForm((f) => ({ ...f, hood_length: e.target.value }))}
              />
            </Field>
            <Field label="Type hotte">
              <Input
                value={form.hood_type}
                onChange={(e) => setForm((f) => ({ ...f, hood_type: e.target.value }))}
              />
            </Field>
            <Field label="Nb filtres">
              <Input
                type="number"
                value={form.filter_count}
                onChange={(e) => setForm((f) => ({ ...f, filter_count: e.target.value }))}
              />
            </Field>
            <Field label="Type filtres">
              <Input
                value={form.filter_type}
                onChange={(e) => setForm((f) => ({ ...f, filter_type: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.duct_present}
                onChange={(e) => setForm((f) => ({ ...f, duct_present: e.target.checked }))}
              />
              Conduit présent
            </label>
            <Field label="Longueur conduit">
              <Input
                value={form.duct_length}
                onChange={(e) => setForm((f) => ({ ...f, duct_length: e.target.value }))}
              />
            </Field>
            <Field label="Accessibilité conduit">
              <Input
                value={form.duct_accessibility}
                onChange={(e) => setForm((f) => ({ ...f, duct_accessibility: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.motor_present}
                onChange={(e) => setForm((f) => ({ ...f, motor_present: e.target.checked }))}
              />
              Moteur présent
            </label>
            <Field label="Type moteur">
              <Input
                value={form.motor_type}
                onChange={(e) => setForm((f) => ({ ...f, motor_type: e.target.value }))}
              />
            </Field>
            <Field label="Accessibilité moteur">
              <Input
                value={form.motor_accessibility}
                onChange={(e) => setForm((f) => ({ ...f, motor_accessibility: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.night_intervention}
                onChange={(e) => setForm((f) => ({ ...f, night_intervention: e.target.checked }))}
              />
              Intervention de nuit possible
            </label>
            <Field label="Préférence horaires">
              <Input
                value={form.schedule_preference}
                onChange={(e) => setForm((f) => ({ ...f, schedule_preference: e.target.value }))}
              />
            </Field>
            <Field label="Niveau d'encrassement">
              <Input
                value={form.soil_level}
                onChange={(e) => setForm((f) => ({ ...f, soil_level: e.target.value }))}
              />
            </Field>
            <Field label="Contraintes / remarques" className="sm:col-span-2">
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                Enregistrer l&apos;installation
              </Button>
            </div>
          </form>
        </RoleGate>
      </CardContent>
    </Card>
  );
}

function ListTab({
  items,
  empty,
}: {
  empty: string;
  items: { id: string; href: string; title: string; subtitle: string; badge: React.ReactNode }[];
}) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              {item.badge}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PhotosTab({
  photos,
  canDelete,
  onChanged,
}: {
  photos: Tables<"intervention_photos">[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Tables<"intervention_photos"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage
          .from(STORAGE_BUCKETS.interventionPhotos)
          .createSignedUrl(p.storage_path, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const remove = useMutation({
    mutationFn: async (photo: Tables<"intervention_photos">) => {
      await supabase.storage.from(STORAGE_BUCKETS.interventionPhotos).remove([photo.storage_path]);
      const { error } = await supabase.from("intervention_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Photo supprimée");
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (photos.length === 0) return <EmptyState title="Aucune photo" />;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            {urls[p.id] ? (
              <img src={urls[p.id]} alt={p.comment ?? p.kind} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">
                Chargement…
              </div>
            )}
            <CardContent className="space-y-2 p-3">
              <p className="text-sm font-medium">{PHOTO_KIND_LABELS[p.kind]}</p>
              <p className="text-xs text-muted-foreground">{p.comment || formatDateTime(p.created_at)}</p>
              {canDelete ? (
                <Button size="sm" variant="outline" onClick={() => setToDelete(p)}>
                  Supprimer
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer cette photo ?"
        description="Action irréversible (admin uniquement)."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </>
  );
}

function DocumentsTab({
  clientId,
  documents,
  userId,
  onChanged,
}: {
  clientId: string;
  documents: Tables<"documents">[];
  userId?: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<Tables<"documents"> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choisissez un fichier");
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.clientDocuments)
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        client_id: clientId,
        doc_type: docType,
        title: title.trim() || file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document ajouté");
      setTitle("");
      setFile(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDoc = async (doc: Tables<"documents">) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.clientDocuments)
      .createSignedUrl(doc.storage_path, 120);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Impossible d'ouvrir le document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = useMutation({
    mutationFn: async (doc: Tables<"documents">) => {
      await supabase.storage.from(STORAGE_BUCKETS.clientDocuments).remove([doc.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <RoleGate permission="documents:write">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Field label="Titre">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fichier">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="sm:col-span-3">
              <Button
                variant="accent"
                disabled={upload.isPending}
                onClick={() => upload.mutate()}
              >
                <Upload className="size-4" />
                Téléverser
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleGate>

      {documents.length === 0 ? (
        <EmptyState title="Aucun document" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[d.doc_type]} · {formatDateTime(d.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void openDoc(d)}>
                    Ouvrir
                  </Button>
                  <RoleGate permission="documents:write">
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(d)}>
                      Supprimer
                    </Button>
                  </RoleGate>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer ce document ?"
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
