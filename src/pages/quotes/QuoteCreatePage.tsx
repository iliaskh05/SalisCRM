import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { QuotePreview } from "@/components/quotes/QuotePreview";
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
import { COMPANY } from "@/lib/company";
import { calculateQuote } from "@/lib/quotes/calculate";
import { nullIfEmpty, todayISO } from "@/lib/format";
import { ensureClientAndInstallationFromLead } from "@/lib/quote-requests/from-lead";
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
  vat_rate: String(COMPANY.defaultVatRate),
  service_catalog_id: null,
});

export function QuoteCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const leadId = params.get("lead");

  const clientsQuery = useQuery({
    queryKey: ["clients-options-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_name, phone, email, address, postal_code, city, siret, business_type")
        .neq("status", "archived")
        .order("company_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_catalog").select("*").eq("active", true).order("label");
      if (error) throw error;
      return (data ?? []) as Tables<"service_catalog">[];
    },
  });

  const leadQuery = useQuery({
    queryKey: ["lead-for-quote", leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId!).single();
      if (error) throw error;
      return data as Tables<"leads">;
    },
  });

  const existingQuoteQuery = useQuery({
    queryKey: ["quote-for-lead", leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const [clientId, setClientId] = useState(params.get("client") ?? "");
  const [installationId, setInstallationId] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState<Line[]>([emptyLine()]);

  const installsQuery = useQuery({
    queryKey: ["installs", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_installations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Tables<"client_installations">[];
    },
  });

  useEffect(() => {
    const c = params.get("client");
    if (c) setClientId(c);
  }, [params]);

  useEffect(() => {
    if (existingQuoteQuery.data?.id) {
      navigate(`/devis/${existingQuoteQuery.data.id}`, { replace: true });
    }
  }, [existingQuoteQuery.data, navigate]);

  useEffect(() => {
    const lead = leadQuery.data;
    if (!lead || existingQuoteQuery.isLoading || existingQuoteQuery.data?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const prepared = await ensureClientAndInstallationFromLead(lead, user?.id ?? null);
        if (cancelled) return;
        setClientId(prepared.clientId);
        if (prepared.installationId) setInstallationId(prepared.installationId);
        if (lead.message?.trim()) {
          setNotes(`Message client : ${lead.message}`);
        }
        await qc.invalidateQueries({ queryKey: ["clients-options-full"] });
        await qc.invalidateQueries({ queryKey: ["installs", prepared.clientId] });
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Impossible de reprendre la demande");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadQuery.data, existingQuoteQuery.isLoading, existingQuoteQuery.data, user?.id, qc]);

  const client = clientsQuery.data?.find((c) => c.id === clientId);
  const installation = installsQuery.data?.find((i) => i.id === installationId);

  const totals = useMemo(
    () =>
      calculateQuote(
        items.map((i) => ({
          label: i.label,
          quantity: Number(i.quantity),
          unitPriceHt: Number(i.unit_price_ht),
          vatRate: Number(i.vat_rate),
        })),
        { discountHt: Number(discount) || 0 },
      ),
    [items, discount],
  );

  const addFromCatalog = (id: string) => {
    const svc = catalogQuery.data?.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => [
      ...prev.filter((l) => l.label.trim()),
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

      // Devis + lignes en une transaction ; référence et totaux calculés en base.
      const { data: quoteId, error } = await supabase.rpc("create_quote", {
        p_client_id: clientId,
        p_items: clean,
        p_lead_id: leadId,
        p_installation_id: installationId || null,
        p_valid_until: nullIfEmpty(validUntil),
        p_notes: nullIfEmpty(notes),
        p_discount_ht: totals.discountHt,
      });
      if (error) throw error;
      const quote = { id: quoteId };

      await logActivity({
        activity_type: "QUOTE_CREATED",
        title: leadId ? "Devis créé depuis une demande site" : "Devis créé",
        client_id: clientId,
        lead_id: leadId,
        created_by: user?.id,
        metadata: { quote_id: quote.id, installation_id: installationId || null },
      });

      if (leadId) {
        await supabase
          .from("leads")
          .update({
            status: "quote_requested",
            converted_client_id: clientId,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", leadId);
      }

      return quote.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Devis créé");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      if (leadId) {
        await qc.invalidateQueries({ queryKey: ["quote-for-lead", leadId] });
        await qc.invalidateQueries({ queryKey: ["lead", leadId] });
        await qc.invalidateQueries({ queryKey: ["quote-requests"] });
      }
      navigate(`/devis/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (clientsQuery.isLoading || (leadId && (leadQuery.isLoading || existingQuoteQuery.isLoading))) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Nouveau devis"
        description={
          leadId
            ? "Client et installation repris depuis la demande. Ajoutez les prestations vous-même — rien n’est généré automatiquement."
            : "Sélectionnez le client, l’installation, puis les prestations. Les totaux se recalculent instantanément."
        }
      />
      {leadId ? (
        <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Les lignes du devis restent vides. Choisissez les prestations dans le catalogue ou saisissez-les manuellement.
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Client *</Label>
                <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setInstallationId(""); }}>
                  <option value="">Sélectionner…</option>
                  {(clientsQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Valable jusqu&apos;au</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            {client ? (
              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                {client.contact_name} · {client.phone} · {client.email}
                <br />
                {[client.address, client.postal_code, client.city].filter(Boolean).join(" ")}
                {client.siret ? ` · SIRET ${client.siret}` : ""}
              </div>
            ) : null}

            <div>
              <Label>Installation</Label>
              <Select value={installationId} onChange={(e) => setInstallationId(e.target.value)}>
                <option value="">—</option>
                {(installsQuery.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>{i.label ?? "Installation"}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Catalogue</Label>
              <Select value="" onChange={(e) => e.target.value && addFromCatalog(e.target.value)}>
                <option value="">Ajouter un service…</option>
                {(catalogQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.label} — {s.unit_price_ht} € HT</option>
                ))}
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lignes</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyLine()])}>
                  <Plus className="size-3.5" />Ligne manuelle
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <Input placeholder="Libellé" value={item.label} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))} />
                  </div>
                  <Input type="number" min={0} step="0.01" placeholder="Qté" value={item.quantity} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))} />
                  <Input type="number" min={0} step="0.01" placeholder="PU HT" value={item.unit_price_ht} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unit_price_ht: e.target.value } : it)))} />
                  <Input type="number" min={0} step="0.01" placeholder="TVA %" value={item.vat_rate} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, vat_rate: e.target.value } : it)))} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Label>Remise HT</Label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="accent" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                Enregistrer le brouillon
              </Button>
              <Button variant="outline" onClick={() => navigate(leadId ? `/demandes-devis/${leadId}` : "/devis")}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
        <QuotePreview
          model={{
            reference: "Aperçu",
            issuedAt: todayISO(),
            validUntil,
            notes,
            client: {
              name: client?.company_name ?? "Client à sélectionner",
              contact: client?.contact_name ?? undefined,
              address: client?.address ?? undefined,
              postalCode: client?.postal_code ?? undefined,
              city: client?.city ?? undefined,
              siret: client?.siret ?? undefined,
            },
            installation: installation
              ? { label: installation.label ?? undefined, hood: [installation.hood_type, installation.hood_length].filter(Boolean).join(" ") }
              : null,
            lines: items.map((l, i) => ({
              label: l.label || "—",
              description: l.description,
              quantity: Number(l.quantity) || 0,
              unitPriceHt: Number(l.unit_price_ht) || 0,
              vatRate: Number(l.vat_rate) || 0,
              lineTotalHt: totals.lines[i]?.lineTotalHt ?? 0,
            })),
            totals,
          }}
        />
      </div>
    </div>
  );
}
