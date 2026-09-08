import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadStatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { isWebsiteQuoteRequest } from "@/lib/quote-requests/source";
import {
  ACTIVITY_TYPE_LABELS,
  LEAD_PRIORITIES,
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/constants";
import { formatDate, formatDateTime, nullIfEmpty } from "@/lib/format";
import type { LeadStatus, Tables } from "@/lib/supabase/types";

async function fetchLead(id: string) {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Tables<"leads">;
}

async function fetchLeadActivities(leadId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tables<"activities">[];
}

export function LeadDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmConvert, setConfirmConvert] = useState(false);

  const leadQuery = useQuery({
    queryKey: ["lead", id],
    queryFn: () => fetchLead(id),
    enabled: Boolean(id),
  });

  const activitiesQuery = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: () => fetchLeadActivities(id),
    enabled: Boolean(id),
  });

  const lead = leadQuery.data;

  const [form, setForm] = useState({
    status: "" as LeadStatus | "",
    priority: "",
    notes: "",
    next_action: "",
    next_action_date: "",
    assigned_user: "",
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      status: lead.status,
      priority: lead.priority ?? "",
      notes: lead.notes ?? "",
      next_action: lead.next_action ?? "",
      next_action_date: lead.next_action_date?.slice(0, 10) ?? "",
      assigned_user: lead.assigned_user ?? "",
    });
  }, [lead]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase
        .from("leads")
        .update({
          status: form.status || lead.status,
          priority: nullIfEmpty(form.priority),
          notes: nullIfEmpty(form.notes),
          next_action: nullIfEmpty(form.next_action),
          next_action_date: nullIfEmpty(form.next_action_date),
          assigned_user: nullIfEmpty(form.assigned_user),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", lead.id);
      if (error) throw error;

      if (form.status && form.status !== lead.status) {
        await logActivity({
          activity_type: "STATUS_CHANGED",
          title: `Statut : ${LEAD_STATUS_LABELS[lead.status]} → ${LEAD_STATUS_LABELS[form.status as LeadStatus]}`,
          lead_id: lead.id,
          created_by: user?.id,
        });
      }
    },
    onSuccess: async () => {
      toast.success("Prospect mis à jour");
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["lead-activities", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("Prospect introuvable");
      if (lead.converted_client_id) {
        return lead.converted_client_id;
      }

      let clientId: string | null = null;

      if (lead.email) {
        const { data: byEmail } = await supabase
          .from("clients")
          .select("id")
          .ilike("email", lead.email)
          .maybeSingle();
        if (byEmail) clientId = byEmail.id;
      }

      if (!clientId && lead.company_name) {
        const { data: byCompany } = await supabase
          .from("clients")
          .select("id")
          .ilike("company_name", lead.company_name)
          .maybeSingle();
        if (byCompany) clientId = byCompany.id;
      }

      if (!clientId) {
        const { data: created, error } = await supabase
          .from("clients")
          .insert({
            company_name: lead.company_name || lead.contact_name || "Client sans nom",
            contact_name: lead.contact_name,
            phone: lead.phone,
            email: lead.email,
            city: lead.city,
            postal_code: lead.postal_code,
            business_type: lead.business_type,
            lead_id: lead.id,
            notes: lead.notes,
            status: "active",
            created_by: user?.id ?? null,
          } as never)
          .select("id")
          .single();
        if (error) throw error;
        clientId = created.id;

        await logActivity({
          activity_type: "CLIENT_CREATED",
          title: `Client créé depuis prospect`,
          client_id: clientId,
          lead_id: lead.id,
          created_by: user?.id,
        });

        // Installation de base si infos hotte présentes
        if (
          lead.hood_length ||
          lead.filter_count ||
          lead.duct_present != null ||
          lead.motor_present != null
        ) {
          await supabase.from("client_installations").insert({
            client_id: clientId,
            label: "Installation principale",
            hood_length: lead.hood_length,
            hood_type: lead.hood_type,
            filter_count: lead.filter_count,
            duct_present: lead.duct_present,
            duct_length: lead.duct_length,
            motor_present: lead.motor_present,
            night_intervention: lead.night_intervention,
            schedule_preference: lead.schedule_preference,
            soil_level: lead.soil_level,
          } as never);
        }
      }

      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          converted_client_id: clientId,
          status: "won",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", lead.id);
      if (leadErr) throw leadErr;

      await logActivity({
        activity_type: "LEAD_CONVERTED",
        title: "Prospect converti en client",
        client_id: clientId,
        lead_id: lead.id,
        created_by: user?.id,
        metadata: { client_id: clientId },
      });

      return clientId!;
    },
    onSuccess: async (clientId) => {
      toast.success("Prospect converti en client");
      setConfirmConvert(false);
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/clients/${clientId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (leadQuery.isLoading) return <LoadingState />;
  if (leadQuery.error || !lead) {
    return <EmptyState title="Prospect introuvable" description={String(leadQuery.error ?? "")} />;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/prospects")}>
        <ArrowLeft className="size-4" />
        Retour
      </Button>

      <PageHeader
        title={lead.company_name || lead.contact_name || "Prospect"}
        description={`${lead.reference ?? lead.id.slice(0, 8)} · Créé le ${formatDate(lead.created_at)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <LeadStatusBadge status={lead.status} />
            <RoleGate permission="leads:write">
              {!lead.converted_client_id ? (
                <Button variant="accent" onClick={() => setConfirmConvert(true)}>
                  <UserPlus className="size-4" />
                  Convertir en client
                </Button>
              ) : (
                <Link
                  to={`/clients/${lead.converted_client_id}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Voir le client
                </Link>
              )}
            </RoleGate>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Contact" value={lead.contact_name} />
            <Row label="Email" value={lead.email} />
            <Row label="Téléphone" value={lead.phone} />
            <Row label="Ville" value={[lead.postal_code, lead.city].filter(Boolean).join(" ")} />
            <Row label="Type" value={lead.business_type} />
            <Row label="Source" value={lead.source} />
            {isWebsiteQuoteRequest(lead) ? (
              <Link to={`/demandes-devis/${lead.id}`} className="text-sm text-teal-700">
                Ouvrir dans Demandes de devis
              </Link>
            ) : null}
            <Row label="Message" value={lead.message} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Suivi commercial</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleGate
              permission="leads:write"
              fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}
            >
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
              >
                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    id="status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}
                  >
                    {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priorité</Label>
                  <Select
                    id="priority"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  >
                    <option value="">—</option>
                    {LEAD_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="next_action">Prochaine action</Label>
                  <Input
                    id="next_action"
                    value={form.next_action}
                    onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="next_action_date">Date d&apos;action</Label>
                  <Input
                    id="next_action_date"
                    type="date"
                    value={form.next_action_date}
                    onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="assigned_user">Assigné</Label>
                  <Input
                    id="assigned_user"
                    value={form.assigned_user}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_user: e.target.value }))}
                    placeholder="Nom ou email"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={5}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </RoleGate>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activitiesQuery.isLoading ? (
            <LoadingState className="py-8" />
          ) : (activitiesQuery.data?.length ?? 0) === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState title="Aucune activité" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activitiesQuery.data!.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
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

      <ConfirmDialog
        open={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        title="Convertir en client ?"
        description="Un client sera créé (ou réutilisé si email / société déjà présents). Le prospect reste en base avec le statut Gagné."
        confirmLabel="Convertir"
        loading={convertMutation.isPending}
        onConfirm={() => convertMutation.mutate()}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}
