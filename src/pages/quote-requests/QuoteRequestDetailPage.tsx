import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { RequestPhotos } from "@/components/media/RequestPhotos";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  businessTypeLabel,
  URGENCY_LABELS,
  FREQUENCY_LABELS,
  REQUEST_TYPE_LABELS,
  yesNo,
} from "@/lib/quote-requests/status";
import { PUBLIC_SITE_URL, sourceLabel } from "@/lib/quote-requests/source";
import { formatDateTime, nullIfEmpty } from "@/lib/format";
import type { LeadStatus, Tables } from "@/lib/supabase/types";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function QuoteRequestDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["lead", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Tables<"leads">;
    },
  });

  const quoteQuery = useQuery({
    queryKey: ["quote-for-lead", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("id, reference, status").eq("lead_id", id).order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const lead = query.data;
  const [status, setStatus] = useState<LeadStatus>("new");
  const [assigned, setAssigned] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!lead) return;
    setStatus(lead.status);
    setAssigned(lead.assigned_user ?? "");
    setNotes(lead.notes ?? "");
  }, [lead]);

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase
        .from("leads")
        .update({
          status,
          assigned_user: nullIfEmpty(assigned),
          notes: nullIfEmpty(notes),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      if (error) throw error;
      if (status !== lead.status) {
        await logActivity({
          activity_type: "STATUS_CHANGED",
          title: `Demande : ${REQUEST_STATUS_LABELS[lead.status]} → ${REQUEST_STATUS_LABELS[status]}`,
          lead_id: lead.id,
          created_by: user?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Demande mise à jour");
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["quote-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error || !lead) {
    return <EmptyState title="Demande introuvable" description={String(query.error ?? "")} />;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/demandes-devis")}>
        <ArrowLeft className="size-4" />
        Demandes de devis
      </Button>
      <PageHeader
        title={lead.company_name || lead.contact_name || "Demande de devis"}
        description={`${lead.reference ?? lead.id.slice(0, 8)} · Reçue le ${formatDateTime(lead.created_at)} · ${sourceLabel(lead.source, lead.landing_page)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{REQUEST_STATUS_LABELS[lead.status]}</Badge>
            <RoleGate permission="quotes:write">
              {quoteQuery.data ? (
                <Button variant="accent" onClick={() => navigate(`/devis/${quoteQuery.data!.id}`)}>
                  <FileText className="size-4" />
                  Ouvrir le devis
                </Button>
              ) : (
                <Button variant="accent" onClick={() => navigate(`/devis/nouveau?lead=${lead.id}`)}>
                  <FileText className="size-4" />
                  Créer le devis
                </Button>
              )}
            </RoleGate>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label="Société" value={lead.company_name} />
            <Row label="Contact" value={lead.contact_name} />
            <Row label="Téléphone" value={lead.phone} />
            <Row label="Email" value={lead.email} />
            <Row label="Adresse" value={lead.address} />
            <Row label="Ville" value={[lead.postal_code, lead.city].filter(Boolean).join(" ")} />
            <Row label="Contact préféré" value={lead.preferred_contact} />
            <Row label="Consentement" value={yesNo(lead.consent)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Établissement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Row label="Type" value={businessTypeLabel(lead.business_type)} />
            <Row label="Type de demande" value={lead.request_type ? REQUEST_TYPE_LABELS[lead.request_type] ?? lead.request_type : "—"} />
            <Row label="Fréquence" value={lead.maintenance_frequency ? FREQUENCY_LABELS[lead.maintenance_frequency] ?? lead.maintenance_frequency : lead.requested_frequency} />
            <Row label="Urgence" value={lead.urgency_level ? URGENCY_LABELS[lead.urgency_level] ?? lead.urgency_level : "—"} />
            <Row label="Dernier nettoyage" value={lead.last_cleaning} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suivi commercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RoleGate permission="leads:write" fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}>
              <div>
                <Label>Statut</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {REQUEST_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Commercial assigné</Label>
                <Input value={assigned} onChange={(e) => setAssigned(e.target.value)} placeholder="Identifiant utilisateur" />
              </div>
              <div>
                <Label>Notes internes</Label>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                Enregistrer
              </Button>
            </RoleGate>
            {lead.converted_client_id ? (
              <Link to={`/clients/${lead.converted_client_id}`} className="block text-sm text-teal-700">
                Ouvrir la fiche client
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
            <Row label="Longueur hotte" value={lead.hood_length} />
            <Row label="Type de hotte" value={lead.hood_type} />
            <Row label="Nombre de filtres" value={lead.filter_count != null ? String(lead.filter_count) : null} />
            <Row label="Type de filtres" value={lead.filter_type} />
            <Row label="Conduits" value={yesNo(lead.duct_present)} />
            <Row label="Longueur conduits" value={lead.duct_length} />
            <Row label="Moteur" value={yesNo(lead.motor_present)} />
            <Row label="Type moteur" value={lead.motor_type} />
            <Row label="Accessibilité" value={lead.accessibility} />
            <Row label="Niveau d’encrassement" value={lead.soil_level} />
            <Row label="Intervention de nuit" value={yesNo(lead.night_intervention)} />
            <Row label="Créneau souhaité" value={lead.schedule_preference} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Demande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Message client" value={lead.message} />
            <Row label="Source" value={sourceLabel(lead.source, lead.landing_page)} />
            <Row label="Page" value={lead.landing_page || PUBLIC_SITE_URL} />
            <Row label="UTM" value={[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ")} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Photos transmises</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestPhotos photos={lead.photos} />
        </CardContent>
      </Card>
    </div>
  );
}
