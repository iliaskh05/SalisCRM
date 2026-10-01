import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/format";
import { fetchInterventionById } from "@/lib/interventions";
import type { Tables } from "@/lib/supabase/types";

export function InterventionReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useAuth();
  const query = useQuery({
    queryKey: ["intervention-report", id, role],
    enabled: Boolean(id),
    queryFn: async () => {
      const [{ data: intervention, error }, { data: report, error: reportError }] = await Promise.all([
        fetchInterventionById(role, id),
        supabase.from("intervention_reports").select("*").eq("intervention_id", id).maybeSingle(),
      ]);
      if (error || !intervention) throw error ?? new Error("Intervention introuvable");
      if (reportError) throw reportError;
      return {
        intervention,
        report: report as Tables<"intervention_reports"> | null,
      };
    },
  });
  const [form, setForm] = useState({
    work: "",
    observations: "",
    difficulties: "",
    recommendations: "",
    providerSignature: "",
    clientSignature: "",
  });

  const report = query.data?.report;
  useEffect(() => {
    if (!report) return;
    setForm({
      work: report.work_completed ?? "",
      observations: report.observations ?? "",
      difficulties: report.difficulties ?? "",
      recommendations: report.recommendations ?? "",
      providerSignature: report.provider_signature ?? "",
      clientSignature: report.client_signature ?? "",
    });
  }, [report]);

  // Rapport + clôture de l'intervention en une transaction ; un rapport validé n'est
  // plus modifiable que par la direction (contrôlé en base).
  const save = useMutation({
    mutationFn: async (validate: boolean) => {
      const { error } = await supabase.rpc("save_intervention_report", {
        p_intervention_id: id,
        p_work_completed: form.work,
        p_observations: form.observations,
        p_difficulties: form.difficulties,
        p_recommendations: form.recommendations,
        p_provider_signature: form.providerSignature,
        p_client_signature: form.clientSignature,
        p_validate: validate,
      });
      if (error) throw error;
      return validate;
    },
    onSuccess: async (validated) => {
      toast.success(validated ? "Rapport validé — intervention terminée" : "Brouillon enregistré");
      await qc.invalidateQueries({ queryKey: ["intervention-report", id] });
      await qc.invalidateQueries({ queryKey: ["intervention", id] });
      await qc.invalidateQueries({ queryKey: ["interventions"] });
      if (validated) navigate(`/interventions/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (!query.data) return <EmptyState title="Intervention introuvable" />;

  const validatedAt = report?.validated_at ?? null;
  const locked = Boolean(validatedAt) && role !== "admin";
  const field = (key: keyof typeof form) => ({
    value: form[key],
    disabled: locked,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/interventions/${id}`)}>← Intervention</Button>
      <PageHeader title="Rapport d’intervention" description={query.data.intervention.reference ?? id.slice(0, 8)} />
      {validatedAt && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Rapport validé le {formatDateTime(validatedAt)}.
          {locked ? " Seule la direction peut encore le modifier." : " Vous pouvez le corriger (direction)."}
        </p>
      )}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Label>Travail réalisé *</Label>
          <Textarea {...field("work")} />
          <Label>Observations</Label>
          <Textarea {...field("observations")} />
          <Label>Difficultés rencontrées</Label>
          <Textarea {...field("difficulties")} />
          <Label>Recommandations au client</Label>
          <Textarea {...field("recommendations")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Signature prestataire (nom)</Label><Input {...field("providerSignature")} /></div>
            <div><Label>Signature client (nom)</Label><Input {...field("clientSignature")} /></div>
          </div>
          {!locked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(false)}>
                Enregistrer le brouillon
              </Button>
              {!validatedAt && (
                <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate(true)}>
                  Valider le rapport et terminer l’intervention
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
