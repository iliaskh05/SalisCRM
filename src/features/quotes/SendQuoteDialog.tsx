import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getEmailProvider, prepareQuoteEmail, sendEmailWithPdf } from "@/lib/email/outbound";
import { formatDate } from "@/lib/format";
import { documentFileName, type BillingDocument } from "@/lib/pdf/document-model";

/** sent = e-mail réellement parti ; manual = transmis par un autre moyen ; demo = simulation */
export type QuoteDelivery = "sent" | "manual" | "demo";

const MODE = {
  resend: {
    tone: "border-teal-200 bg-teal-50 text-teal-950",
    title: "Envoi par e-mail",
    text: "Le devis part à l’adresse ci-dessous avec son PDF en pièce jointe. Il passe en « envoyé » uniquement si l’e-mail a bien été expédié.",
    action: "Envoyer le devis",
    busy: "Envoi…",
  },
  none: {
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    title: "Envoi e-mail non configuré",
    text: "Aucun e-mail ne partira d’ici. Téléchargez le PDF et transmettez-le vous-même, puis marquez le devis comme envoyé.",
    action: "Marquer comme envoyé manuellement",
    busy: "Enregistrement…",
  },
  demo: {
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    title: "Mode démonstration",
    text: "Aucun e-mail n’est envoyé : le devis est seulement marqué comme envoyé.",
    action: "Simuler l’envoi",
    busy: "Préparation…",
  },
} as const;

export function SendQuoteDialog({
  open,
  onClose,
  to,
  clientName,
  reference,
  validUntil,
  document,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  to: string;
  clientName: string;
  reference: string;
  validUntil?: string | null;
  /** Données du PDF joint (requis pour l'envoi réel) */
  document?: BillingDocument;
  onConfirm: (delivery: QuoteDelivery) => Promise<void> | void;
}) {
  const provider = getEmailProvider();
  const mode = MODE[provider];
  const prepared = useMemo(
    () => prepareQuoteEmail({ to, clientName, reference, validUntil: validUntil ? formatDate(validUntil) : null }),
    [to, clientName, reference, validUntil],
  );
  const [busy, setBusy] = useState(false);
  const canSend = provider !== "resend" || (Boolean(prepared.to) && Boolean(document));

  async function confirm() {
    setBusy(true);
    try {
      if (provider === "resend") {
        if (!document) throw new Error("Document indisponible.");
        const { buildDocumentPdf } = await import("@/lib/pdf/download");
        await sendEmailWithPdf(prepared, await buildDocumentPdf(document), documentFileName(document));
      }
      await onConfirm(provider === "resend" ? "sent" : provider === "demo" ? "demo" : "manual");
      toast.success(provider === "resend" ? `Devis envoyé à ${prepared.to}` : "Devis marqué comme envoyé");
      onClose();
    } catch (e) {
      toast.error(provider === "resend" ? "E-mail non envoyé" : "Enregistrement impossible", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Envoyer le devis" wide>
      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${mode.tone}`}>
        <p className="font-semibold">{mode.title}</p>
        <p className="mt-1">{mode.text}</p>
      </div>
      <div className="space-y-3">
        <div>
          <Label>Destinataire</Label>
          <Input value={prepared.to || "Adresse e-mail du client manquante"} readOnly />
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
        <Button variant="accent" disabled={busy || !canSend} onClick={() => void confirm()}>
          {busy ? mode.busy : mode.action}
        </Button>
      </div>
    </Dialog>
  );
}
