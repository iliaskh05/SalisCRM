import { COMPANY } from "../company.ts";
import { documentFileName, type BillingDocument } from "./document-model.ts";
import type { PdfLogo } from "./render.ts";

/** Point d'entrée des pages : jsPDF n'est chargé qu'au premier téléchargement. */

let logoPromise: Promise<PdfLogo | null> | undefined;

function loadLogo(): Promise<PdfLogo | null> {
  logoPromise ??= (async () => {
    try {
      const res = await fetch(COMPANY.logoSrc);
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const aspect = await new Promise<number>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalHeight / img.naturalWidth);
        img.onerror = () => reject(new Error("logo illisible"));
        img.src = dataUrl;
      });
      return { dataUrl, aspect };
    } catch {
      // Sans logo, l'en-tête affiche la raison sociale : le PDF reste valide.
      return null;
    }
  })();
  return logoPromise;
}

export async function buildDocumentPdf(source: BillingDocument): Promise<Blob> {
  const [{ renderDocumentPdf }, logo] = await Promise.all([import("./render.ts"), loadLogo()]);
  const bytes = await renderDocumentPdf(source, { logo });
  return new Blob([bytes], { type: "application/pdf" });
}

export async function downloadDocumentPdf(source: BillingDocument): Promise<void> {
  const blob = await buildDocumentPdf(source);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = documentFileName(source);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
