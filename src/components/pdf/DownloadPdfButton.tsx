import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BillingDocument } from "@/lib/pdf/document-model";

/** Télécharge un PDF de devis / facture / avoir. jsPDF n'est chargé qu'au premier clic. */
export function DownloadPdfButton({
  document,
  label = "PDF",
  variant = "outline",
}: {
  document: BillingDocument;
  label?: string;
  variant?: "outline" | "accent";
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const { downloadDocumentPdf } = await import("@/lib/pdf/download");
      await downloadDocumentPdf(document);
    } catch (e) {
      toast.error("PDF non généré", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={variant} disabled={busy} onClick={() => void onClick()}>
      <FileDown className="size-3.5" />
      {busy ? "Génération…" : label}
    </Button>
  );
}
