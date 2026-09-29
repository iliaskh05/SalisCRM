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

type Line = {
  label: string;
  description: string;
  quantity: string;
  unit_price_ht: string;
  vat_rate: string;
};

const emptyLine = (): Line => ({
  label: "",
  description: "",
  quantity: "1",
  unit_price_ht: "0",
  vat_rate: "20",
});

export function InvoiceCreatePage() {
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

  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Line[]>([emptyLine()]);

  useEffect(() => {
    const c = params.get("client");
    if (c) setClientId(c);
  }, [params]);

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
        }))
        .filter((i) => i.label && i.quantity > 0);
      if (clean.length === 0) throw new Error("Ajoutez au moins une ligne");

      // Facture + lignes en une transaction ; numéro, date et totaux imposés par la base.
      const { data: invoiceId, error } = await supabase.rpc("create_invoice", {
        p_client_id: clientId,
        p_items: clean,
        p_due_at: nullIfEmpty(dueAt),
        p_notes: nullIfEmpty(notes),
      });
      if (error) throw error;
      const invoice = { id: invoiceId };

      await logActivity({
        activity_type: "INVOICE_CREATED",
        title: "Facture créée",
        client_id: clientId,
        created_by: user?.id,
        metadata: { invoice_id: invoice.id },
      });

      return invoice.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Facture créée");
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      navigate(`/factures/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (clientsQuery.isLoading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouvelle facture" />
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
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
              <Label>Date d&apos;émission</Label>
              <Input type="date" value={todayISO()} disabled title="Fixée au jour d’émission (numérotation chronologique)" />
            </div>
            <div>
              <Label>Échéance (J+30 si vide)</Label>
              <Input type="date" min={todayISO()} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Lignes</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyLine()])}>
                <Plus className="size-3.5" />
                Ligne
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <Input
                  className="sm:col-span-2"
                  placeholder="Libellé"
                  value={item.label}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))
                  }
                />
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  value={item.unit_price_ht}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, unit_price_ht: e.target.value } : it)),
                    )
                  }
                />
                <Input
                  type="number"
                  value={item.vat_rate}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, vat_rate: e.target.value } : it)))
                  }
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
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
              Créer
            </Button>
            <Button variant="outline" onClick={() => navigate("/factures")}>
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
