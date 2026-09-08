import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { nullIfEmpty, todayISO } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type Line = {
  label: string;
  description: string;
  quantity: string;
  unit_price_ht: string;
  vat_rate: string;
  service_catalog_id: string | null;
};

const emptyLine = (): Line => ({
  label: "",
  description: "",
  quantity: "1",
  unit_price_ht: "0",
  vat_rate: "20",
  service_catalog_id: null,
});

export function QuoteCreatePage() {
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

  const catalogQuery = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("*")
        .eq("active", true)
        .order("label");
      if (error) throw error;
      return (data ?? []) as Tables<"service_catalog">[];
    },
  });

  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<Line[]>([emptyLine()]);

  useEffect(() => {
    const c = params.get("client");
    if (c) setClientId(c);
  }, [params]);

  const addFromCatalog = (id: string) => {
    const svc = catalogQuery.data?.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      {
        label: svc.label,
        description: svc.description ?? "",
        quantity: "1",
        unit_price_ht: String(svc.unit_price_ht),
        vat_rate: String(svc.vat_rate),
        service_catalog_id: svc.id,
      },
    ]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Client obligatoire");
      const clean = items
        .map((i) => ({
          label: i.label.trim(),
          description: nullIfEmpty(i.description),
          quantity: Number(i.quantity),
          unit_price_ht: Number(i.unit_price_ht),
          vat_rate: Number(i.vat_rate),
          service_catalog_id: i.service_catalog_id,
        }))
        .filter((i) => i.label && i.quantity > 0);
      if (clean.length === 0) throw new Error("Ajoutez au moins une ligne");

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert({
          client_id: clientId,
          status: "draft",
          issued_at: todayISO(),
          valid_until: nullIfEmpty(validUntil),
          notes: nullIfEmpty(notes),
          subtotal_ht: 0,
          vat_amount: 0,
          total_ttc: 0,
          created_by: user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsErr } = await supabase.from("quote_items").insert(
        clean.map((item, index) => ({
          quote_id: quote.id,
          label: item.label,
          description: item.description,
          quantity: item.quantity,
          unit_price_ht: item.unit_price_ht,
          vat_rate: item.vat_rate,
          position: index,
          service_catalog_id: item.service_catalog_id,
        })) as never,
      );
      if (itemsErr) throw itemsErr;

      await logActivity({
        activity_type: "QUOTE_CREATED",
        title: "Devis créé",
        client_id: clientId,
        created_by: user?.id,
        metadata: { quote_id: quote.id },
      });

      return quote.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Devis créé");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      navigate(`/devis/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (clientsQuery.isLoading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouveau devis" />
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Client *</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {(clientsQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Valable jusqu&apos;au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Ajouter depuis le catalogue</Label>
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) addFromCatalog(e.target.value);
              }}
            >
              <option value="">Choisir un service…</option>
              {(catalogQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.unit_price_ht} € HT
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Lignes</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyLine()])}>
                <Plus className="size-3.5" />
                Ligne manuelle
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Libellé"
                    value={item.label}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))
                    }
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Qté"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="PU HT"
                  value={item.unit_price_ht}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, unit_price_ht: e.target.value } : it)),
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="TVA %"
                  value={item.vat_rate}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, vat_rate: e.target.value } : it)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="accent" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Créer le devis
            </Button>
            <Button variant="outline" onClick={() => navigate("/devis")}>
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
