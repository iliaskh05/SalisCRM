import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dispatchPreparedEmail, prepareQuoteEmail } from "@/lib/email/outbound";
import { formatDate } from "@/lib/format";

export function SendQuoteDialog({
  open,
  onClose,
  to,
  clientName,
  reference,
  validUntil,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  to: string;
  clientName: string;
  reference: string;
  validUntil?: string | null;
  onConfirm: () => Promise<void> | void;
}) {
  const prepared = useMemo(
    () => prepareQuoteEmail({ to, clientName, reference, validUntil: validUntil ? formatDate(validUntil) : null }),
    [to, clientName, reference, validUntil],
  );
  const preview = dispatchPreparedEmail(prepared);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Envoyer le devis"
      description="Préparation d’un e-mail professionnel. La transmission SMTP n’est connectée que si un fournisseur est configuré."
      wide
    >
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">{preview.title}</p>
        <p className="mt-1">{preview.description}</p>
      </div>
      <div className="space-y-3">
        <div>
          <Label>Destinataire</Label>
          <Input value={prepared.to || "Adresse manquante"} readOnly />
        </div>
        <div>
          <Label>Objet</Label>
          <Input value={prepared.subject} readOnly />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea value={prepared.body} readOnly rows={10} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="accent"
          disabled={busy || !prepared.to}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              toast.message(preview.title, { description: preview.description });
              onClose();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Envoi impossible");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Préparation…" : preview.mode === "demo" ? "Préparer l’e-mail de démo" : "Marquer prêt / envoyé"}
        </Button>
      </div>
    </Dialog>
  );
}
