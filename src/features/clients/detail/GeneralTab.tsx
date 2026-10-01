import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, nullIfEmpty } from "@/lib/format";
import type { ClientStatus, Tables } from "@/lib/supabase/types";
import { Field, Metric } from "./fields";

export function GeneralTab({
  client,
  financial,
  showFinancial,
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
  /** Synthèse financière : réservée aux rôles qui voient la finance (pas le prestataire) */
  showFinancial: boolean;
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
        })
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

      {showFinancial && (
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
      )}
    </div>
  );
}
