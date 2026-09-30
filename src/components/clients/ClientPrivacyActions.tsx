import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { storageFileName } from "@/lib/storage";

type Props = { clientId: string; reference: string | null; hasInvoices: boolean };

/** Droit d'accès / portabilité (export) et droit à l'effacement (anonymisation). Direction uniquement. */
export function ClientPrivacyActions({ clientId, reference, hasInvoices }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [includeCompany, setIncludeCompany] = useState(false);

  const exportData = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_client_data", { p_client_id: clientId });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = storageFileName(`donnees-${reference ?? clientId.slice(0, 8)}.json`).replace(/^\d+-/, "");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    onSuccess: () => toast.success("Export téléchargé", { description: "Cet export est enregistré dans le journal d’audit." }),
    onError: (e: Error) => toast.error("Export impossible", { description: e.message }),
  });

  const anonymize = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("anonymize_client", {
        p_client_id: clientId,
        p_reason: reason.trim(),
        p_include_company: includeCompany,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (result) => {
      const docs = result.documents_to_review.length;
      toast.success("Client anonymisé", {
        description: docs > 0 ? `${docs} document(s) déposé(s) à vérifier et supprimer si nécessaire (onglet Documents).` : undefined,
      });
      setOpen(false);
      setReason("");
      setIncludeCompany(false);
      await qc.invalidateQueries({ queryKey: ["client", clientId] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error("Anonymisation impossible", { description: e.message }),
  });

  return (
    <>
      <Button size="sm" variant="outline" disabled={exportData.isPending} onClick={() => exportData.mutate()}>
        <Download className="size-3.5" />
        Exporter les données
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <EyeOff className="size-3.5" />
        Anonymiser
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Anonymiser ce client"
        description="Efface les données personnelles : contact, téléphone, e-mail, notes, demande d’origine, et leurs anciennes valeurs dans le journal d’audit. Les factures, devis et paiements sont conservés (obligation légale de 10 ans). Action irréversible."
      >
        <div className="space-y-3">
          <div>
            <Label>Motif *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. : demande d’effacement reçue par e-mail le …"
            />
          </div>
          <label className={`flex items-start gap-2 text-sm ${hasInvoices ? "text-muted-foreground" : ""}`}>
            <input
              type="checkbox"
              className="mt-1"
              checked={includeCompany && !hasInvoices}
              disabled={hasInvoices}
              onChange={(e) => setIncludeCompany(e.target.checked)}
            />
            <span>
              Anonymiser aussi le nom / la raison sociale
              {hasInvoices ? " — impossible : ce client a des factures, son nom doit être conservé." : ""}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={anonymize.isPending}>
              Annuler
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!reason.trim() || anonymize.isPending}
              onClick={() => anonymize.mutate()}
            >
              {anonymize.isPending ? "Patientez…" : "Anonymiser définitivement"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
