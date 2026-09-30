// Tests unitaires : modèles de documents et rendu PDF. Lancer : npm run test:unit
import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuote } from "../quotes/calculate.ts";
import {
  companyBankDetails,
  creditNoteToDocument,
  documentFileName,
  invoiceToDocument,
  isValidIban,
  quoteToDocument,
  vatBreakdown,
  type BillingDocument,
} from "./document-model.ts";
import { renderDocumentPdf } from "./render.ts";

const ITEMS = [
  { id: "1", label: "Dégraissage hotte", description: null, quantity: 1, unit_price_ht: 480, vat_rate: 20 },
  { id: "2", label: "Filtres inox", description: "Lot de 6", quantity: 6, unit_price_ht: 24.9, vat_rate: 20 },
  { id: "3", label: "Conduits", description: null, quantity: 18, unit_price_ht: 32.45, vat_rate: 10 },
];
const CLIENT = { company_name: "Brasserie Élise", city: "Marseille" };

// Totaux tels que la base les calcule (même formule que calculateQuote, testée côté SQL)
const calc = calculateQuote(
  ITEMS.map((i) => ({ label: i.label, quantity: i.quantity, unitPriceHt: i.unit_price_ht, vatRate: i.vat_rate })),
  { discountHt: 63.9 },
);
const STORED = {
  subtotal_ht: calc.subtotalHt,
  discount_ht: calc.discountHt,
  vat_amount: calc.vatAmount,
  total_ttc: calc.totalTtc,
};
const BASE_ROW = { id: "row-1", client_id: "c1", created_at: "2026-09-30T10:00:00Z", notes: null, ...STORED };

const quoteDoc = () =>
  quoteToDocument({
    quote: { ...BASE_ROW, reference: "D-2026-0042", issued_at: "2026-09-30", valid_until: "2026-10-30", deposit_amount: 500, payment_terms: null, status: "sent", lead_id: null, installation_id: null, created_by: null, updated_at: "", converted_intervention_id: null },
    items: ITEMS as never,
    client: CLIENT,
  });

const invoiceDoc = (status: "unpaid" | "partially_paid" | "cancelled", paid: number[]) =>
  invoiceToDocument({
    invoice: { ...BASE_ROW, number: "F-2026-0017", issued_at: "2026-09-30", due_at: "2026-10-30", status, quote_id: null, created_by: null, updated_at: "", cancelled_at: null, cancellation_reason: null },
    items: ITEMS as never,
    client: CLIENT,
    payments: paid.map((amount, i) => ({ id: `p${i}`, amount, paid_at: "2026-10-02", method: "transfer", reference: null })) as never,
  });

test("ventilation TVA : somme des groupes = totaux enregistrés", () => {
  const doc = quoteDoc();
  assert.equal(doc.vatRows.length, 2);
  assert.deepEqual(doc.vatRows.map((r) => r.rate), [10, 20]);
  const base = doc.vatRows.reduce((s, r) => s + r.baseHt, 0);
  const vat = doc.vatRows.reduce((s, r) => s + r.vat, 0);
  assert.equal(Math.round(base * 100) / 100, doc.totals.taxableHt);
  assert.equal(Math.round(vat * 100) / 100, doc.totals.vatAmount);
});

test("ventilation TVA : l'écart d'arrondi est absorbé, jamais inventé", () => {
  const rows = vatBreakdown(
    [
      { lineTotalHt: 33.33, vatRate: 20 },
      { lineTotalHt: 33.33, vatRate: 20 },
      { lineTotalHt: 33.34, vatRate: 20 },
    ],
    0,
    { taxableHt: 100, vatAmount: 20 },
  );
  assert.deepEqual(rows, [{ rate: 20, baseHt: 100, vat: 20 }]);
});

test("IBAN : clé mod 97, et l'IBAN de démonstration est refusé", () => {
  assert.equal(isValidIban("FR76 3000 6000 0112 3456 7890 189"), true);
  assert.equal(isValidIban("FR76 3000 6000 0112 3456 7890 188"), false);
  assert.equal(isValidIban("n'importe quoi"), false);
  assert.equal(companyBankDetails(), null, "l'IBAN de démonstration ne doit jamais être imprimé");
});

test("nom de fichier sûr", () => {
  assert.equal(documentFileName({ kind: "invoice", reference: "F-2026-0017" }), "Facture-F-2026-0017.pdf");
  assert.equal(documentFileName({ kind: "credit_note", reference: "AV 2026/3" }), "Avoir-AV-2026-3.pdf");
});

test("facture partiellement payée : reste dû calculé", () => {
  const doc = invoiceDoc("partially_paid", [500, 250.5]);
  assert.equal(doc.amountPaid, 750.5);
  assert.equal(doc.amountDue, Math.round((doc.totals.totalTtc - 750.5) * 100) / 100);
  assert.equal(doc.watermark, null);
});

test("facture annulée : filigrane et rien à payer", () => {
  const doc = invoiceDoc("cancelled", []);
  assert.equal(doc.watermark, "ANNULÉE");
  assert.equal(doc.amountDue, 0);
});

test("avoir : montants en négatif, lignes reprises de la facture", () => {
  const doc = creditNoteToDocument({
    creditNote: { id: "cn", number: "AV-2026-0003", invoice_id: "i", client_id: "c", issued_at: "2026-10-05", reason: "Erreur de client", ...STORED, lines: ITEMS as never, created_by: null, created_at: "" },
    client: CLIENT,
    invoiceNumber: "F-2026-0017",
  });
  assert.equal(doc.sign, -1);
  assert.equal(doc.lines.length, 3);
  assert.match(doc.relatedLine ?? "", /F-2026-0017/);
  assert.match(doc.relatedLine ?? "", /Erreur de client/);
});

async function render(doc: BillingDocument) {
  // Non compressé : le texte reste lisible dans le flux pour les assertions
  const bytes = new Uint8Array(await renderDocumentPdf(doc, { compress: false }));
  const text = Buffer.from(bytes).toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  return { text, pages, header: text.slice(0, 5) };
}

test("rendu : un vrai PDF contenant référence, montants et mentions légales", async () => {
  const { text, pages, header } = await render(invoiceDoc("partially_paid", [500]));
  assert.equal(header, "%PDF-");
  assert.equal(pages, 1);
  assert.match(text, /F-2026-0017/);
  assert.match(text, /1 324,18/); // total TTC, séparateur de milliers ASCII
  assert.doesNotMatch(text, / /); // pas d'espace fine insécable (illisible en police standard)
  assert.match(text, /Escompte pour paiement/);
  assert.match(text, /SIRET/);
});

test("rendu : un document long est paginé, avec pied de page sur chaque page", async () => {
  const doc = quoteDoc();
  doc.lines = Array.from({ length: 60 }, (_, i) => ({
    label: `Prestation ${i + 1}`,
    description: i % 4 === 0 ? "Détail de la prestation sur site occupé." : null,
    quantity: 1,
    unitPriceHt: 100,
    vatRate: 20,
    lineTotalHt: 100,
  }));
  const { text, pages } = await render(doc);
  assert.ok(pages >= 3, `attendu ≥ 3 pages, obtenu ${pages}`);
  for (let i = 1; i <= pages; i++) assert.match(text, new RegExp(`Page ${i}/${pages}`));
});

test("rendu : sans logo, le PDF reste valide", async () => {
  const bytes = await renderDocumentPdf(quoteDoc(), { logo: null });
  assert.ok(bytes.byteLength > 2000);
});
