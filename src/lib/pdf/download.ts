import { COMPANY } from "../company.ts";
import { documentFileName, type BillingDocument } from "./document-model.ts";
import type { PdfFonts, PdfLogo } from "./render.ts";
import regularFontUrl from "./assets/Roboto-Regular.ttf?url";
import boldFontUrl from "./assets/Roboto-Bold.ttf?url";
import iccUrl from "./assets/sRGB.icc?url";

/** Point d'entrée des pages : jsPDF et pdf-lib ne sont chargés qu'au premier téléchargement. */

let logoPromise: Promise<PdfLogo | null> | undefined;
let assetsPromise: Promise<{ fonts: PdfFonts; icc: ArrayBuffer }> | undefined;

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

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ressource PDF introuvable (${url})`);
  return res.arrayBuffer();
}

/** Polices Roboto (intégrées à chaque PDF) et profil couleur sRGB (PDF/A). Téléchargés une seule fois. */
function loadAssets() {
  assetsPromise ??= Promise.all([fetchBinary(regularFontUrl), fetchBinary(boldFontUrl), fetchBinary(iccUrl)])
    .then(([regular, bold, icc]) => ({ fonts: { regular, bold }, icc }))
    .catch((e) => {
      assetsPromise = undefined; // nouvel essai au prochain clic
      throw e;
    });
  return assetsPromise;
}

/**
 * Devis : PDF classique. Factures et avoirs : Factur-X (PDF/A-3 + XML EN 16931 joint),
 * contrôlé avec le validateur Mustang / veraPDF (npm run test:facturx).
 */
export async function buildDocumentPdf(source: BillingDocument): Promise<Blob> {
  const [{ renderDocumentPdf }, logo, assets] = await Promise.all([import("./render.ts"), loadLogo(), loadAssets()]);

  if (source.kind === "quote") {
    const bytes = await renderDocumentPdf(source, { logo, fonts: assets.fonts });
    return new Blob([bytes], { type: "application/pdf" });
  }

  const { buildFacturXPdf } = await import("../facturx/index.ts");
  const { pdf } = await buildFacturXPdf(source, { ...assets, logo });
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
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
