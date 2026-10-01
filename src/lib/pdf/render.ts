import { COMPANY } from "../company.ts";
import { formatDate } from "../format.ts";
import type { jsPDF } from "jspdf";
import { companyBankDetails, round2, type BillingDocument } from "./document-model.ts";

/** Rendu A4 des devis, factures et avoirs (jsPDF). Chargé à la demande : voir download.ts. */

export type PdfLogo = { dataUrl: string; aspect: number };
export type PdfFonts = { regular: ArrayBuffer; bold: ArrayBuffer };
export type RenderOptions = {
  logo?: PdfLogo | null;
  compress?: boolean;
  /** Polices TrueType à intégrer au fichier (requis pour le PDF/A-3 / Factur-X). Sans elles : Helvetica standard. */
  fonts?: PdfFonts | null;
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const M = 15; // marge
const PAGE_W = 210;
const PAGE_H = 297;
const CW = PAGE_W - 2 * M;
const FOOTER_TOP = PAGE_H - 22;

type RGB = [number, number, number];
const TEAL: RGB = [15, 118, 110];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const RULE: RGB = [226, 232, 240];

const KIND_LABEL = { quote: "DEVIS", invoice: "FACTURE", credit_note: "AVOIR" } as const;
const METHOD_LABEL = { cash: "Espèces", transfer: "Virement", card: "Carte", check: "Chèque", other: "Autre" } as const;

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Les polices PDF standard n'ont ni espace fine insécable ni vrai signe moins. */
function plain(text: string): string {
  return text.replace(/[  ]/g, " ").replace(/−/g, "-");
}

/** Termine une phrase par un point si besoin (les conditions saisies n’en ont pas toujours). */
function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function makeMoney(sign: 1 | -1) {
  return (value: number) => plain(eur.format(round2(value * sign) || 0));
}

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export async function renderDocumentPdf(source: BillingDocument, options: RenderOptions = {}): Promise<ArrayBuffer> {
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc: AutoTableDoc = new JsPDF({
    unit: "mm",
    format: "a4",
    compress: options.compress ?? true,
    putOnlyUsedFonts: true, // PDF/A : aucune police standard non intégrée dans le fichier
  });
  let FONT = "helvetica";
  if (options.fonts) {
    doc.addFileToVFS("Roboto-Regular.ttf", toBase64(options.fonts.regular));
    doc.addFileToVFS("Roboto-Bold.ttf", toBase64(options.fonts.bold));
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    FONT = "Roboto";
  }
  const money = makeMoney(source.sign);
  const title = KIND_LABEL[source.kind];

  doc.setProperties({
    title: `${title} ${source.reference}`,
    author: COMPANY.legalName,
    subject: `${title} ${source.reference} — ${source.client.name}`,
  });

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const rule = (y: number) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(M, y, PAGE_W - M, y);
  };
  const ensureSpace = (y: number, needed: number) => {
    if (y + needed <= FOOTER_TOP) return y;
    doc.addPage();
    return M;
  };
  const lastY = () => doc.lastAutoTable?.finalY ?? M;

  // ---------- En-tête ----------
  let leftY = 12;
  if (options.logo) {
    const w = 34;
    const h = w * options.logo.aspect;
    doc.addImage(options.logo.dataUrl, "PNG", M, leftY, w, h);
    leftY += h + 3;
  } else {
    doc.setFont(FONT, "bold").setFontSize(15);
    color(INK);
    doc.text(COMPANY.legalName, M, leftY + 6);
    leftY += 10;
  }
  doc.setFont(FONT, "normal").setFontSize(8);
  color(MUTED);
  for (const line of [COMPANY.addressLine, `${COMPANY.postalCode} ${COMPANY.city}`, `${COMPANY.phone} · ${COMPANY.email}`]) {
    doc.text(line, M, leftY + 3);
    leftY += 3.8;
  }

  const rx = PAGE_W - M;
  doc.setFont(FONT, "bold").setFontSize(9);
  color(TEAL);
  doc.text(title.split("").join(" "), rx, 16, { align: "right" });
  doc.setFontSize(17);
  color(INK);
  doc.text(source.reference, rx, 24, { align: "right" });
  doc.setFont(FONT, "normal").setFontSize(8.5);
  color(MUTED);
  let ry = 30;
  const rightLine = (text: string) => {
    doc.text(text, rx, ry, { align: "right" });
    ry += 4.2;
  };
  rightLine(`Émis le ${formatDate(source.issuedAt)}`);
  if (source.validUntil) rightLine(`Valable jusqu’au ${formatDate(source.validUntil)}`);
  if (source.dueAt) rightLine(`Échéance : ${formatDate(source.dueAt)}`);

  let y = Math.max(leftY, ry) + 4;
  rule(y);
  y += 6;

  // ---------- Émetteur / client ----------
  const half = CW / 2 - 4;
  const party = (x: number, heading: string, name: string, lines: string[]) => {
    doc.setFont(FONT, "bold").setFontSize(7);
    color(MUTED);
    doc.text(heading.toUpperCase(), x, y);
    doc.setFont(FONT, "bold").setFontSize(10);
    color(INK);
    doc.text(name, x, y + 5, { maxWidth: half });
    doc.setFont(FONT, "normal").setFontSize(8.5);
    color(MUTED);
    let ly = y + 9.5;
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, half) as string[];
      doc.text(wrapped, x, ly);
      ly += wrapped.length * 4;
    }
    return ly;
  };
  const c = source.client;
  const emitterEnd = party(M, "Émetteur", COMPANY.legalName, [
    `SIREN ${COMPANY.siren}`,
    `SIRET ${COMPANY.siret}`,
    `TVA intracommunautaire ${COMPANY.vatNumber}`,
    `${COMPANY.rcs} · APE ${COMPANY.ape}`,
  ]);
  const clientEnd = party(
    M + CW / 2 + 4,
    source.kind === "credit_note" ? "Client crédité" : "Client",
    c.name,
    [
      c.contact ?? "",
      [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      c.siret ? `SIRET ${c.siret}` : "",
      c.phone ?? "",
      c.email ?? "",
    ].filter(Boolean),
  );
  y = Math.max(emitterEnd, clientEnd) + 2;

  const note = (text: string) => {
    doc.setFont(FONT, "normal").setFontSize(8.5);
    const wrapped = doc.splitTextToSize(text, CW - 8) as string[];
    const h = wrapped.length * 4 + 5;
    y = ensureSpace(y, h);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(M, y, CW, h, 1.5, 1.5, "F");
    color(INK);
    doc.text(wrapped, M + 4, y + 5);
    y += h + 3;
  };
  if (source.relatedLine) note(source.relatedLine);
  if (source.siteLine) note(`Lieu d’intervention : ${source.siteLine}`);
  y += 2;

  // ---------- Lignes ----------
  const descByRow = new Map<number, string[]>();
  // interligne jsPDF (×1.15) converti en mm : 9 pt et 8 pt
  const LABEL_LH = (9 * 1.15 * 25.4) / 72;
  const DESC_LH = (8 * 1.15 * 25.4) / 72;
  const PAD = 2;
  const COLS = { qty: 16, unit: 28, vat: 16, total: 30 };
  const labelWidth = CW - COLS.qty - COLS.unit - COLS.vat - COLS.total;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 26 },
    theme: "plain",
    head: [["Prestation", "Qté", "PU HT", "TVA", "Total HT"]],
    body: source.lines.map((l) => [l.label, plain(num.format(l.quantity)), money(l.unitPriceHt), `${plain(num.format(l.vatRate))} %`, money(l.lineTotalHt)]),
    styles: { font: FONT, fontSize: 9, textColor: INK, cellPadding: PAD, overflow: "linebreak" },
    headStyles: { fontSize: 7.5, fontStyle: "bold", textColor: MUTED, lineColor: RULE, lineWidth: { bottom: 0.3, top: 0.3, left: 0, right: 0 } },
    bodyStyles: { lineColor: RULE, lineWidth: { bottom: 0.15, top: 0, left: 0, right: 0 } },
    columnStyles: {
      0: { cellWidth: labelWidth, fontStyle: "bold" },
      1: { cellWidth: COLS.qty, halign: "right" },
      2: { cellWidth: COLS.unit, halign: "right" },
      3: { cellWidth: COLS.vat, halign: "right" },
      4: { cellWidth: COLS.total, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      if (data.section !== "body" || data.column.index !== 0) return;
      const line = source.lines[data.row.index];
      doc.setFont(FONT, "bold").setFontSize(9);
      const labelLines = doc.splitTextToSize(line.label, labelWidth - 2 * PAD) as string[];
      data.cell.text = labelLines;
      let height = 2 * PAD + labelLines.length * LABEL_LH;
      if (line.description?.trim()) {
        doc.setFont(FONT, "normal").setFontSize(8);
        const descLines = doc.splitTextToSize(line.description.trim(), labelWidth - 2 * PAD) as string[];
        descByRow.set(data.row.index, descLines);
        height += descLines.length * DESC_LH + 0.5;
      }
      data.cell.styles.minCellHeight = height;
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const descLines = descByRow.get(data.row.index);
      if (!descLines) return;
      const labelLines = data.cell.text.length;
      doc.setFont(FONT, "normal").setFontSize(8);
      color(MUTED);
      doc.text(descLines, data.cell.x + PAD, data.cell.y + PAD + labelLines * LABEL_LH + 0.5, { baseline: "top" });
    },
  });
  y = lastY() + 7;

  // ---------- Ventilation TVA + totaux ----------
  const t = source.totals;
  const totalRows: [string, string, boolean?][] = [["Total HT", money(t.subtotalHt)]];
  if (t.discountHt > 0) totalRows.push(["Remise HT", money(-t.discountHt)]);
  totalRows.push(["Net HT", money(t.taxableHt)], ["TVA", money(t.vatAmount)], [`Total TTC`, money(t.totalTtc), true]);
  if (source.kind === "invoice") {
    totalRows.push(["Déjà réglé", money(-(source.amountPaid ?? 0))], ["Reste à payer", money(source.amountDue ?? 0), true]);
  } else if (source.kind === "quote" && (source.deposit ?? 0) > 0) {
    totalRows.push(["Acompte à la commande", money(source.deposit ?? 0)], ["Solde", money(t.totalTtc - (source.deposit ?? 0)), true]);
  }
  const ROW_H = 5.6;
  const boxH = totalRows.length * ROW_H + 6;
  const vatH = (source.vatRows.length + 1) * 6.5 + 2;
  y = ensureSpace(y, Math.max(boxH, vatH));
  const blockTop = y;

  autoTable(doc, {
    startY: blockTop,
    margin: { left: M, right: PAGE_W - M - 90 },
    tableWidth: 90,
    theme: "plain",
    head: [["Taux TVA", "Base HT", "Montant TVA"]],
    body: source.vatRows.map((r) => [`${plain(num.format(r.rate))} %`, money(r.baseHt), money(r.vat)]),
    styles: { font: FONT, fontSize: 8.5, textColor: INK, cellPadding: 1.6 },
    headStyles: { fontSize: 7.5, fontStyle: "bold", textColor: MUTED, lineColor: RULE, lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 } },
    bodyStyles: { lineColor: RULE, lineWidth: { bottom: 0.15, top: 0, left: 0, right: 0 } },
    columnStyles: { 0: { cellWidth: 26 }, 1: { halign: "right", cellWidth: 32 }, 2: { halign: "right", cellWidth: 32 } },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
    },
  });
  const vatEnd = lastY();

  const boxX = M + CW - 82;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, blockTop, 82, boxH, 1.5, 1.5, "S");
  let ty = blockTop + 5.4;
  for (const [label, value, strong] of totalRows) {
    doc.setFont(FONT, strong ? "bold" : "normal").setFontSize(strong ? 10 : 8.5);
    color(strong ? INK : MUTED);
    doc.text(label, boxX + 4, ty);
    color(INK);
    doc.text(value, boxX + 78, ty, { align: "right" });
    ty += ROW_H;
  }
  y = Math.max(vatEnd, blockTop + boxH) + 7;

  // ---------- Règlements reçus ----------
  if (source.kind === "invoice" && source.payments && source.payments.length > 0) {
    y = ensureSpace(y, 8 + source.payments.length * 6);
    doc.setFont(FONT, "bold").setFontSize(7.5);
    color(MUTED);
    doc.text("RÈGLEMENTS REÇUS", M, y);
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: PAGE_W - M - 110 },
      tableWidth: 110,
      theme: "plain",
      body: source.payments.map((p) => [formatDate(p.paidAt), METHOD_LABEL[p.method], p.reference ?? "", money(p.amount)]),
      styles: { font: FONT, fontSize: 8.5, textColor: INK, cellPadding: 1.4 },
      bodyStyles: { lineColor: RULE, lineWidth: { bottom: 0.15, top: 0, left: 0, right: 0 } },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 2: { cellWidth: 34 }, 3: { halign: "right", cellWidth: 28 } },
    });
    y = lastY() + 6;
  }

  // ---------- Conditions et mentions légales ----------
  const paragraphs: { heading?: string; text: string }[] = [];
  if (source.kind === "invoice") {
    paragraphs.push({
      heading: "Conditions de règlement",
      text: `${sentence(source.paymentTerms || COMPANY.paymentTermsDefault)}${source.dueAt ? ` Échéance : ${formatDate(source.dueAt)}.` : ""} Escompte pour paiement anticipé : néant.`,
    });
    paragraphs.push({ text: COMPANY.latePenalty });
    paragraphs.push({ text: COMPANY.vatRegime });
    const bank = companyBankDetails();
    if (bank) paragraphs.push({ heading: "Règlement par virement", text: `IBAN ${bank.iban} · BIC ${bank.bic}` });
  } else if (source.kind === "quote") {
    paragraphs.push({ heading: "Conditions de paiement", text: sentence(source.paymentTerms || COMPANY.paymentTermsDefault) });
    paragraphs.push({ text: COMPANY.latePenalty });
    paragraphs.push({ text: COMPANY.vatRegime });
    const bank = companyBankDetails();
    if (bank) paragraphs.push({ heading: "Règlement par virement", text: `IBAN ${bank.iban} · BIC ${bank.bic}` });
  } else {
    paragraphs.push({ text: "Avoir portant annulation de la facture référencée ci-dessus. Les montants s’entendent en déduction de la facture d’origine." });
  }
  if (source.notes?.trim()) paragraphs.push({ heading: "Notes", text: source.notes.trim() });

  for (const p of paragraphs) {
    doc.setFont(FONT, "normal").setFontSize(8);
    const wrapped = doc.splitTextToSize(p.text, CW) as string[];
    y = ensureSpace(y, wrapped.length * 3.6 + (p.heading ? 5 : 0) + 2);
    if (p.heading) {
      doc.setFont(FONT, "bold").setFontSize(8);
      color(INK);
      doc.text(p.heading, M, y);
      y += 4;
    }
    doc.setFont(FONT, "normal").setFontSize(8);
    color(MUTED);
    doc.text(wrapped, M, y);
    y += wrapped.length * 3.6 + 2.5;
  }

  // ---------- Bon pour accord (devis) ----------
  if (source.kind === "quote") {
    y = ensureSpace(y, 30);
    const boxW = CW / 2 - 3;
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.roundedRect(M, y, boxW, 24, 1.5, 1.5, "S");
    doc.roundedRect(M + boxW + 6, y, boxW, 24, 1.5, 1.5, "S");
    doc.setLineDashPattern([], 0);
    doc.setFont(FONT, "bold").setFontSize(8.5);
    color(INK);
    doc.text("Bon pour accord — le client", M + 4, y + 6);
    doc.text(COMPANY.legalName, M + boxW + 10, y + 6);
    doc.setFont(FONT, "normal").setFontSize(7.5);
    color(MUTED);
    doc.text("Date, cachet et signature précédés de « Bon pour accord »", M + 4, y + 10.5);
    doc.text("Signature", M + boxW + 10, y + 10.5);
  }

  // ---------- Filigrane + pied de page sur chaque page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (source.watermark) {
      doc.saveGraphicsState();
      const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
      doc.setGState(new GState({ opacity: 0.12 }) as never);
      doc.setFont(FONT, "bold").setFontSize(96);
      doc.setTextColor(220, 38, 38);
      doc.text(source.watermark, PAGE_W / 2, PAGE_H / 2 + 20, { align: "center", angle: 35 });
      doc.restoreGraphicsState();
    }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(M, FOOTER_TOP + 4, PAGE_W - M, FOOTER_TOP + 4);
    doc.setFont(FONT, "normal").setFontSize(7);
    color(MUTED);
    doc.text(
      `${COMPANY.legalName} — ${COMPANY.addressLine}, ${COMPANY.postalCode} ${COMPANY.city} — ${COMPANY.phone} — ${COMPANY.email}`,
      PAGE_W / 2,
      FOOTER_TOP + 8.5,
      { align: "center" },
    );
    doc.text(
      `Capital ${COMPANY.capital} — ${COMPANY.rcs} — SIRET ${COMPANY.siret} — TVA ${COMPANY.vatNumber} — APE ${COMPANY.ape}`,
      PAGE_W / 2,
      FOOTER_TOP + 12,
      { align: "center" },
    );
    doc.text(`Page ${i}/${pages}`, PAGE_W - M, FOOTER_TOP + 16, { align: "right" });
  }

  return doc.output("arraybuffer");
}
