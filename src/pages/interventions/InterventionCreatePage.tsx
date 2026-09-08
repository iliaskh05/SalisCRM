import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { INTERVENTION_STATUS_LABELS } from "@/lib/constants";
import { nullIfEmpty } from "@/lib/format";
import type { InterventionStatus } from "@/lib/supabase/types";

export function InterventionCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const clientsQuery = useQuery({
    queryKey: ["clients-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name")
        .neq("status", "archived")
        .order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const providersQuery = useQuery({
    queryKey: ["providers-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    client_id: params.get("client") ?? "",
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
    const c = params.get("client");
    if (c) setForm((f) => ({ ...f, client_id: c }));
  }, [params]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error("Client obligatoire");
      const { data, error } = await supabase
        .from("interventions")
        .insert({
          client_id: form.client_id,
          provider_id: nullIfEmpty(form.provider_id),
          scheduled_date: nullIfEmpty(form.scheduled_date),
          time_slot: nullIfEmpty(form.time_slot),
          service_type: nullIfEmpty(form.service_type),
          status: form.status,
          description: nullIfEmpty(form.description),
          price_ht: form.price_ht === "" ? null : Number(form.price_ht),
          notes: nullIfEmpty(form.notes),
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      await logActivity({
        activity_type: "INTERVENTION_CREATED",
        title: "Intervention créée",
        client_id: form.client_id,
        created_by: user?.id,
        metadata: { intervention_id: data.id },
      });
      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Intervention créée");
      await qc.invalidateQueries({ queryKey: ["interventions"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/interventions/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (clientsQuery.isLoading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouvelle intervention" />
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Client *</Label>
            <Select
              required
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
            >
              <option value="">Sélectionner…</option>
              {(clientsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Créneau</Label>
            <Input
              value={form.time_slot}
              onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))}
              placeholder="ex. 8h-12h"
            />
          </div>
          <div>
            <Label>Prestataire</Label>
            <Select
              value={form.provider_id}
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
            <Label>Type de service</Label>
            <Input
              value={form.service_type}
              onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
            />
          </div>
          <div>
            <Label>Statut</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InterventionStatus }))}
            >
              {(Object.keys(INTERVENTION_STATUS_LABELS) as InterventionStatus[]).map((s) => (
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
              onChange={(e) => setForm((f) => ({ ...f, price_ht: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="accent" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Créer
            </Button>
            <Button variant="outline" onClick={() => navigate("/interventions")}>
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
