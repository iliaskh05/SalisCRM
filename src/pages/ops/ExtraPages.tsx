import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/lib/supabase/types";

export function InterventionReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["intervention", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("interventions").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Tables<"interventions">;
    },
  });
  const [work, setWork] = useState("");
  const [obs, setObs] = useState("");
  const [signP, setSignP] = useState("");
  const [signC, setSignC] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error("Intervention introuvable");
      const report = `Travail : ${work}\nObservations : ${obs}\nPrestataire : ${signP}\nClient : ${signC}`;
      const { error } = await supabase
        .from("interventions")
        .update({
          notes: report,
          status: signP && signC ? "completed" : query.data.status,
          completed_at: signP && signC ? new Date().toISOString() : query.data.completed_at,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
      if (signP && signC) {
        await logActivity({
          activity_type: "INTERVENTION_COMPLETED",
          title: "Rapport validé",
          client_id: query.data.client_id,
          created_by: user?.id,
          metadata: { intervention_id: id },
        });
      }
    },
    onSuccess: async () => {
      toast.success("Rapport enregistré");
      await qc.invalidateQueries({ queryKey: ["intervention", id] });
      navigate(`/interventions/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (!query.data) return <EmptyState title="Intervention introuvable" />;

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/interventions/${id}`)}>← Intervention</Button>
      <PageHeader title="Rapport d’intervention" description={query.data.reference ?? id.slice(0, 8)} />
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Label>Travail réalisé</Label>
          <Textarea value={work} onChange={(e) => setWork(e.target.value)} />
          <Label>Observations</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Signature prestataire</Label><Input value={signP} onChange={(e) => setSignP(e.target.value)} /></div>
            <div><Label>Signature client</Label><Input value={signC} onChange={(e) => setSignC(e.target.value)} /></div>
          </div>
          <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>Enregistrer</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CatalogPage() {
  const query = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_catalog").select("*").order("label");
      if (error) throw error;
      return (data ?? []) as Tables<"service_catalog">[];
    },
  });
  if (query.isLoading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Catalogue prestations" />
      <Card>
        <CardContent className="divide-y p-0">
          {(query.data ?? []).map((s) => (
            <div key={s.id} className="flex justify-between px-5 py-3 text-sm">
              <span>{s.label}</span>
              <span>{s.unit_price_ht} € HT / {s.unit}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" description="Identité société, numérotation et catalogue." />
      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <BrandLogo size="md" />
          <p>Salis 3 Hottes · 12 rue de la Fontaine, 75011 Paris</p>
          <p>SIREN 848 392 017 · SIRET 848 392 017 00017 · TVA FR48 848392017</p>
          <p>Les utilisateurs et rôles se gèrent dans Supabase (staff_profiles). L’inscription publique ne peut pas s’auto-promouvoir admin.</p>
          <p>Facturation électronique : architecture prête (Factur-X / UBL / CII). Aucune PDP n’est connectée.</p>
          <Link to="/produits" className="text-teal-700">Ouvrir le catalogue</Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function ChatPlaceholderPage() {
  return (
    <div>
      <PageHeader title="Messages" description="Messagerie interne temps réel : prête à connecter (Supabase Realtime)." />
      <EmptyState title="Aucun canal connecté" description="En mode démonstration, ouvrez l’application avec VITE_DEMO_MODE=true pour la messagerie interactive." />
    </div>
  );
}
