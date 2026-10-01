import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Upload, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InterventionStatusBadge } from "@/components/ui/status-badge";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth/permissions";
import { supabase } from "@/lib/supabase/client";
import { storageFileName } from "@/lib/storage";
import { logActivity } from "@/lib/activities";
import {
  INTERVENTION_STATUS_LABELS,
  PHOTO_KIND_LABELS,
  STORAGE_BUCKETS,
} from "@/lib/constants";
import { formatCurrency, formatDateTime, nullIfEmpty } from "@/lib/format";
import type { InterventionStatus, PhotoKind, StaffRole, Tables } from "@/lib/supabase/types";
import { fetchInterventionById } from "@/lib/interventions";

async function fetchIntervention(role: StaffRole | null, id: string) {
  const { data, error } = await fetchInterventionById(role, id);
  if (error || !data) throw error ?? new Error("Intervention introuvable");
  const intervention = data;

  const [{ data: client }, { data: provider }, { data: photos }] = await Promise.all([
    supabase.from("clients").select("id, company_name").eq("id", intervention.client_id).maybeSingle(),
    intervention.provider_id
      ? supabase.from("providers").select("id, name").eq("id", intervention.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("intervention_photos")
      .select("*")
      .eq("intervention_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    intervention,
    client,
    provider,
    photos: (photos ?? []) as Tables<"intervention_photos">[],
  };
}

/** Miroir de trg_interventions_provider_guard : démarrer ou terminer, rien d’autre. */
function providerStatusOptions(current: InterventionStatus): InterventionStatus[] {
  if (current === "to_plan" || current === "planned") return [current, "in_progress", "completed"];
  if (current === "in_progress") return [current, "completed"];
  return [current];
}

export function InterventionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, role } = useAuth();

  const query = useQuery({
    queryKey: ["intervention", id, role],
    queryFn: () => fetchIntervention(role, id),
    enabled: Boolean(id),
  });

  const providersQuery = useQuery({
    queryKey: ["providers-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("providers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const intervention = query.data?.intervention;
  // Le prestataire ne fait qu’avancer SES interventions (contrôle réel : RLS + trigger en base)
  const isProvider = role === "prestataire";
  const providerLocked = isProvider && (intervention?.status === "completed" || intervention?.status === "cancelled");
  const [form, setForm] = useState({
    provider_id: "",
    scheduled_date: "",
    time_slot: "",
    service_type: "",
    status: "to_plan" as InterventionStatus,
    description: "",
    price_ht: "",
    notes: "",
  });

  useEffect(() => {
    if (!intervention) return;
    setForm({
      provider_id: intervention.provider_id ?? "",
      scheduled_date: intervention.scheduled_date?.slice(0, 10) ?? "",
      time_slot: intervention.time_slot ?? "",
      service_type: intervention.service_type ?? "",
      status: intervention.status,
      description: intervention.description ?? "",
      price_ht: intervention.price_ht?.toString() ?? "",
      notes: intervention.notes ?? "",
    });
  }, [intervention]);

  const save = useMutation({
    mutationFn: async () => {
      if (!intervention) return;

      // Prestataire : fonction dédiée (statut + notes). Elle horodate la fin et journalise
      // elle-même ; il n'a plus aucun accès direct à la table (prix, affectation).
      if (isProvider) {
        const { error } = await supabase.rpc("provider_update_intervention", {
          p_intervention_id: intervention.id,
          p_status: form.status,
          p_notes: nullIfEmpty(form.notes),
        });
        if (error) throw error;
        return;
      }

      const completed =
        form.status === "completed" && intervention.status !== "completed"
          ? new Date().toISOString()
          : intervention.completed_at;
      const { error } = await supabase
        .from("interventions")
        .update({
          provider_id: nullIfEmpty(form.provider_id),
          scheduled_date: nullIfEmpty(form.scheduled_date),
          time_slot: nullIfEmpty(form.time_slot),
          service_type: nullIfEmpty(form.service_type),
          status: form.status,
          description: nullIfEmpty(form.description),
          price_ht: form.price_ht === "" ? null : Number(form.price_ht),
          notes: nullIfEmpty(form.notes),
          completed_at: completed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intervention.id);
      if (error) throw error;

      if (form.status === "completed" && intervention.status !== "completed") {
        await logActivity({
          activity_type: "INTERVENTION_COMPLETED",
          title: "Intervention terminée",
          client_id: intervention.client_id,
          created_by: user?.id,
          metadata: { intervention_id: intervention.id },
        });
      }
    },
    onSuccess: async () => {
      toast.success("Intervention enregistrée");
      await qc.invalidateQueries({ queryKey: ["intervention", id] });
      await qc.invalidateQueries({ queryKey: ["interventions"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return <EmptyState title="Intervention introuvable" description={String(query.error ?? "")} />;
  }

  const { client, photos } = query.data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/interventions")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={intervention!.reference ?? "Intervention"}
        description={
          <>
            Client :{" "}
            <Link to={`/clients/${intervention!.client_id}`} className="text-accent hover:underline">
              {client?.company_name ?? "—"}
            </Link>
          </>
        }
        actions={
          <div className="flex gap-2">
            <InterventionStatusBadge status={intervention!.status} />
            <Button size="sm" variant="outline" onClick={() => navigate(`/interventions/${id}/report`)}>
              <ClipboardCheck className="size-3.5" />
              Rapport
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleGate permission="interventions:write" fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Créneau</Label>
                  <Input
                    value={form.time_slot}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Prestataire</Label>
                  <Select
                    value={form.provider_id}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(providersQuery.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Service</Label>
                  <Input
                    value={form.service_type}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={form.status}
                    disabled={providerLocked}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InterventionStatus }))}
                  >
                    {(isProvider ? providerStatusOptions(intervention!.status) : (Object.keys(INTERVENTION_STATUS_LABELS) as InterventionStatus[])).map((s) => (
                      <option key={s} value={s}>
                        {INTERVENTION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Prix HT</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_ht}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, price_ht: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    disabled={isProvider}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    disabled={providerLocked}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                {!isProvider && (
                  <div className="sm:col-span-2 text-sm text-muted-foreground">
                    Prix actuel : {formatCurrency(intervention!.price_ht)}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={save.isPending || providerLocked}>
                    Enregistrer
                  </Button>
                </div>
              </form>
            </RoleGate>
          </CardContent>
        </Card>

        <PhotosSection
          intervention={intervention!}
          photos={photos}
          canDelete={isAdmin(role)}
          userId={user?.id}
          onChanged={() => qc.invalidateQueries({ queryKey: ["intervention", id] })}
        />
      </div>
    </div>
  );
}

function PhotosSection({
  intervention,
  photos,
  canDelete,
  userId,
  onChanged,
}: {
  intervention: Tables<"interventions">;
  photos: Tables<"intervention_photos">[];
  canDelete: boolean;
  userId?: string;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<PhotoKind>("before");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choisissez une image");
      const path = `${intervention.client_id}/${intervention.id}/${storageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.interventionPhotos)
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("intervention_photos").insert({
        intervention_id: intervention.id,
        client_id: intervention.client_id,
        kind,
        storage_path: path,
        comment: nullIfEmpty(comment),
        uploaded_by: userId ?? null,
      });
      if (error) {
        await supabase.storage.from(STORAGE_BUCKETS.interventionPhotos).remove([path]);
        throw error;
      }
      await logActivity({
        activity_type: "PHOTO_UPLOADED",
        title: `Photo ${PHOTO_KIND_LABELS[kind]} ajoutée`,
        client_id: intervention.client_id,
        created_by: userId,
        metadata: { intervention_id: intervention.id },
      });
    },
    onSuccess: () => {
      toast.success("Photo téléversée");
      setFile(null);
      setComment("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (photo: Tables<"intervention_photos">) => {
      // Ligne d’abord : si la suppression est refusée, le fichier reste consultable
      const { error } = await supabase.from("intervention_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from(STORAGE_BUCKETS.interventionPhotos).remove([photo.storage_path]);
    },
    onSuccess: () => {
      toast.success("Photo supprimée");
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RoleGate permission="photos:write">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)}>
                {(Object.keys(PHOTO_KIND_LABELS) as PhotoKind[]).map((k) => (
                  <option key={k} value={k}>
                    {PHOTO_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fichier</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Commentaire</Label>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button variant="accent" size="sm" disabled={upload.isPending} onClick={() => upload.mutate()}>
                <Upload className="size-3.5" />
                Téléverser
              </Button>
            </div>
          </div>
        </RoleGate>

        {photos.length === 0 ? (
          <EmptyState title="Aucune photo" className="py-8" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg border border-border">
                {urls[p.id] ? (
                  <img src={urls[p.id]} alt={p.comment ?? p.kind} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-muted text-xs">Chargement…</div>
                )}
                <div className="space-y-1 p-2 text-xs">
                  <p className="font-medium">{PHOTO_KIND_LABELS[p.kind]}</p>
                  <p className="text-muted-foreground">{p.comment || formatDateTime(p.created_at)}</p>
                  {canDelete ? (
                    <Button size="sm" variant="outline" onClick={() => setToDelete(p)}>
                      Supprimer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer cette photo ?"
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </Card>
  );
}
