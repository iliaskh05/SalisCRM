import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activities";
import { clientCreateSchema } from "@/lib/validations";
import { CLIENT_STATUS_LABELS } from "@/lib/constants";
import { nullIfEmpty } from "@/lib/format";
import type { ClientStatus } from "@/lib/supabase/types";

export function ClientCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postal_code: "",
    siret: "",
    business_type: "",
    notes: "",
    next_action: "",
    next_action_date: "",
    status: "active" as ClientStatus,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = clientCreateSchema.parse({
        ...form,
        email: form.email || null,
      });
      const { data, error } = await supabase
        .from("clients")
        .insert({
          company_name: parsed.company_name,
          contact_name: nullIfEmpty(parsed.contact_name as string | null),
          phone: nullIfEmpty(parsed.phone as string | null),
          email: nullIfEmpty(parsed.email as string | null),
          address: nullIfEmpty(parsed.address as string | null),
          city: nullIfEmpty(parsed.city as string | null),
          postal_code: nullIfEmpty(parsed.postal_code as string | null),
          siret: nullIfEmpty(parsed.siret as string | null),
          business_type: nullIfEmpty(parsed.business_type as string | null),
          notes: nullIfEmpty(parsed.notes as string | null),
          next_action: nullIfEmpty(form.next_action),
          next_action_date: nullIfEmpty(form.next_action_date),
          status: parsed.status,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logActivity({
        activity_type: "CLIENT_CREATED",
        title: `Client créé : ${parsed.company_name}`,
        client_id: data.id,
        created_by: user?.id,
      });

      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Client créé");
      await qc.invalidateQueries({ queryKey: ["clients"] });
      navigate(`/clients/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouveau client" description="Création manuelle d'un dossier client." />
      <Card>
        <CardContent className="pt-5">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="sm:col-span-2">
              <Label>Raison sociale *</Label>
              <Input
                required
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contact</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>SIRET</Label>
              <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Adresse</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>Code postal</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </div>
            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>Type d&apos;activité</Label>
              <Input
                value={form.business_type}
                onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
              />
            </div>
            <div>
              <Label>Statut</Label>
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
            </div>
            <div>
              <Label>Prochaine action</Label>
              <Input
                value={form.next_action}
                onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
              />
            </div>
            <div>
              <Label>Date d&apos;action</Label>
              <Input
                type="date"
                value={form.next_action_date}
                onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="accent" disabled={mutation.isPending}>
                {mutation.isPending ? "Création…" : "Créer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/clients")}>
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
