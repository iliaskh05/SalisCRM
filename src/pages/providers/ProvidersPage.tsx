import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { PROVIDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, nullIfEmpty } from "@/lib/format";
import type { ProviderStatus, Tables } from "@/lib/supabase/types";

type FormState = {
  name: string;
  company_name: string;
  phone: string;
  email: string;
  city: string;
  intervention_zone: string;
  specialty: string;
  cost_rate: string;
  status: ProviderStatus;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  company_name: "",
  phone: "",
  email: "",
  city: "",
  intervention_zone: "",
  specialty: "",
  cost_rate: "",
  status: "active",
  notes: "",
});

export function ProvidersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"providers"> | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [toDelete, setToDelete] = useState<Tables<"providers"> | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("providers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"providers">[];
    },
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        company_name: editing.company_name ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        city: editing.city ?? "",
        intervention_zone: editing.intervention_zone ?? "",
        specialty: editing.specialty ?? "",
        cost_rate: editing.cost_rate?.toString() ?? "",
        status: editing.status,
        notes: editing.notes ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      [p.name, p.company_name, p.city, p.specialty, p.email].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nom obligatoire");
      const payload = {
        name: form.name.trim(),
        company_name: nullIfEmpty(form.company_name),
        phone: nullIfEmpty(form.phone),
        email: nullIfEmpty(form.email),
        city: nullIfEmpty(form.city),
        intervention_zone: nullIfEmpty(form.intervention_zone),
        specialty: nullIfEmpty(form.specialty),
        cost_rate: form.cost_rate === "" ? null : Number(form.cost_rate),
        status: form.status,
        notes: nullIfEmpty(form.notes),
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("providers").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("providers").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Prestataire mis à jour" : "Prestataire créé");
      setOpen(false);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("providers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Prestataire supprimé");
      setToDelete(null);
      await qc.invalidateQueries({ queryKey: ["providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <EmptyState title="Erreur" description={String(error)} />;

  return (
    <div>
      <PageHeader
        title="Prestataires"
        description="Réseau d'intervenants terrain (écriture admin)."
        actions={
          <RoleGate permission="providers:write">
            <Button
              variant="accent"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nouveau prestataire
            </Button>
          </RoleGate>
        }
      />

      <div className="mb-4 max-w-md">
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun prestataire" />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <TR>
                <TH>Nom</TH>
                <TH>Société</TH>
                <TH>Ville / Zone</TH>
                <TH>Spécialité</TH>
                <TH>Tarif</TH>
                <TH>Statut</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.phone || p.email || ""}</div>
                  </TD>
                  <TD>{p.company_name || "—"}</TD>
                  <TD>
                    <div>{p.city || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.intervention_zone || ""}</div>
                  </TD>
                  <TD>{p.specialty || "—"}</TD>
                  <TD>{p.cost_rate != null ? formatCurrency(p.cost_rate) : "—"}</TD>
                  <TD>
                    <Badge variant={p.status === "active" ? "success" : "outline"}>
                      {PROVIDER_STATUS_LABELS[p.status]}
                    </Badge>
                  </TD>
                  <TD>
                    <RoleGate permission="providers:write">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(p)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </RoleGate>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Modifier le prestataire" : "Nouveau prestataire"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nom *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Société</Label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Ville</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <Label>Zone d&apos;intervention</Label>
            <Input
              value={form.intervention_zone}
              onChange={(e) => setForm((f) => ({ ...f, intervention_zone: e.target.value }))}
            />
          </div>
          <div>
            <Label>Spécialité</Label>
            <Input
              value={form.specialty}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
            />
          </div>
          <div>
            <Label>Tarif / coût</Label>
            <Input
              type="number"
              step="0.01"
              value={form.cost_rate}
              onChange={(e) => setForm((f) => ({ ...f, cost_rate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Statut</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProviderStatus }))}
            >
              {(Object.keys(PROVIDER_STATUS_LABELS) as ProviderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROVIDER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>
              Enregistrer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer ce prestataire ?"
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id);
        }}
      />
    </div>
  );
}
