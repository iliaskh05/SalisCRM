import type { BillingDocument } from "../pdf/document-model.ts";
import { COMPANY } from "../company.ts";
import { renderDocumentPdf, type PdfFonts, type PdfLogo } from "../pdf/render.ts";
import { buildFacturXml } from "./cii.ts";
import { toFacturXPdf } from "./pdfa.ts";

export { buildFacturXml } from "./cii.ts";

export type FacturXAssets = { fonts: PdfFonts; icc: ArrayBuffer; logo?: PdfLogo | null };

/**
 * Facture (ou avoir) au format Factur-X : PDF/A-3B lisible par un humain + XML EN 16931 joint.
 * Les polices sont intégrées (obligatoire en PDF/A).
 */
export async function buildFacturXPdf(
  source: BillingDocument,
  assets: FacturXAssets,
  createdAt: Date = new Date(),
): Promise<{ pdf: Uint8Array; xml: string }> {
  const xml = buildFacturXml(source);
  const base = await renderDocumentPdf(source, { logo: assets.logo, fonts: assets.fonts, compress: true });
  const label = source.kind === "credit_note" ? "Avoir" : "Facture";
  const pdf = await toFacturXPdf(base, {
    xml,
    title: `${label} ${source.reference}`,
    subject: `${label} ${source.reference} — ${source.client.name}`,
    author: COMPANY.legalName,
    icc: assets.icc,
    createdAt,
  });
  return { pdf, xml };
}
