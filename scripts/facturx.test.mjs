// Tests unitaires Factur-X (rapides, sans Java). La validation officielle est dans
// scripts/facturx-validate.mjs (npm run test:facturx).
import assert from "node:assert/strict";
import test from "node:test";
import { buildFacturXml } from "../src/lib/facturx/cii.ts";
import { buildFacturXPdf } from "../src/lib/facturx/index.ts";
import { quoteToDocument } from "../src/lib/pdf/document-model.ts";
import { fixtures, loadAssets } from "./facturx-fixtures.mjs";

const docs = fixtures();
// Dernière occurrence : le récapitulatif de l'en-tête vient après les lignes (LineTotalAmount existe aux deux niveaux)
const amount = (xml, tag) => [...xml.matchAll(new RegExp(`<ram:${tag}[^>]*>([\\d.]+)</ram:${tag}>`, "g"))].at(-1)?.[1];

test("facture : type 380, identifiants, totaux repris tels qu'enregistrés", () => {
  const d = docs["facture-remise-2-taux"];
  const xml = buildFacturXml(d);
  assert.match(xml, /<ram:TypeCode>380<\/ram:TypeCode>/);
  assert.match(xml, /<ram:ID>F-2026-0017<\/ram:ID>/);
  assert.match(xml, /<ram:ID>urn:cen\.eu:en16931:2017<\/ram:ID>/);
  assert.equal(amount(xml, "GrandTotalAmount"), d.totals.totalTtc.toFixed(2));
  assert.equal(amount(xml, "TaxBasisTotalAmount"), d.totals.taxableHt.toFixed(2));
  assert.equal(amount(xml, "TaxTotalAmount"), d.totals.vatAmount.toFixed(2));
  assert.equal(amount(xml, "LineTotalAmount"), d.totals.subtotalHt.toFixed(2));
});

test("facture : acompte déduit du net à payer", () => {
  const d = docs["facture-remise-2-taux"]; // 500 € déjà réglés
  const xml = buildFacturXml(d);
  assert.equal(amount(xml, "TotalPrepaidAmount"), "500.00");
  assert.equal(amount(xml, "DuePayableAmount"), (d.totals.totalTtc - 500).toFixed(2));
});

test("remise : une remise par taux de TVA, dont la somme = remise totale", () => {
  const xml = buildFacturXml(docs["facture-remise-2-taux"]);
  const allowances = [...xml.matchAll(/<ram:ActualAmount>([\d.]+)<\/ram:ActualAmount>/g)].map((m) => Number(m[1]));
  assert.equal(allowances.length, 2);
  assert.equal(Math.round(allowances.reduce((a, b) => a + b, 0) * 100) / 100, 63.9);
  assert.equal(amount(xml, "AllowanceTotalAmount"), "63.90");
});

test("sans remise : aucune remise de document", () => {
  const xml = buildFacturXml(docs["facture-sans-remise"]);
  assert.doesNotMatch(xml, /SpecifiedTradeAllowanceCharge/);
  assert.doesNotMatch(xml, /AllowanceTotalAmount/);
  assert.doesNotMatch(xml, /TotalPrepaidAmount/);
});

test("TVA à 0 % : catégorie exonérée avec motif (obligatoire en EN 16931)", () => {
  const xml = buildFacturXml(docs["facture-tva-zero"]);
  assert.match(xml, /<ram:CategoryCode>E<\/ram:CategoryCode>/);
  assert.match(xml, /<ram:ExemptionReason>Exonération de TVA<\/ram:ExemptionReason>/);
  assert.match(xml, /<ram:CategoryCode>S<\/ram:CategoryCode>/);
});

test("mentions légales françaises (pénalités, indemnité, escompte) sur factures ET avoirs", () => {
  for (const name of ["facture-sans-remise", "avoir"]) {
    const xml = buildFacturXml(docs[name]);
    for (const code of ["PMD", "PMT", "AAB"]) assert.match(xml, new RegExp(`<ram:SubjectCode>${code}</ram:SubjectCode>`), `${name} : ${code}`);
  }
});

test("avoir : type 381, montants positifs, facture annulée référencée avec sa date", () => {
  const d = docs["avoir"];
  const xml = buildFacturXml(d);
  assert.match(xml, /<ram:TypeCode>381<\/ram:TypeCode>/);
  assert.equal(amount(xml, "GrandTotalAmount"), d.totals.totalTtc.toFixed(2));
  assert.doesNotMatch(xml, />-\d/);
  assert.match(xml, /<ram:IssuerAssignedID>F-2026-0018<\/ram:IssuerAssignedID>/);
  assert.match(xml, /<qdt:DateTimeString format="102">20260930<\/qdt:DateTimeString>/);
});

test("un devis n'a pas de Factur-X", () => {
  const q = quoteToDocument({
    quote: { id: "q", reference: "D-1", client_id: "c", lead_id: null, installation_id: null, status: "draft", issued_at: "2026-09-30", valid_until: null, notes: null, discount_ht: 0, deposit_amount: 0, payment_terms: null, converted_intervention_id: null, subtotal_ht: 0, vat_amount: 0, total_ttc: 0, created_by: null, created_at: "", updated_at: "" },
    items: [],
    client: { company_name: "X" },
  });
  assert.throws(() => buildFacturXml(q), /pas une facture/);
});

test("échappement XML : & < > \" et caractères de contrôle", () => {
  const d = structuredClone(docs["facture-sans-remise"]);
  d.client.name = 'Dupont & Fils <SARL> "Le Bon"';
  d.lines[0].label = "Ligne\u0014 avec & signe";
  const xml = buildFacturXml(d);
  assert.match(xml, /Dupont &amp; Fils &lt;SARL&gt; &quot;Le Bon&quot;/);
  assert.match(xml, /Ligne avec &amp; signe/);
  assert.doesNotMatch(xml, /\u0014/);
});

test("SIRET client → identifiant 0009, SIREN vendeur → 0002", () => {
  const xml = buildFacturXml(docs["facture-sans-remise"]);
  assert.match(xml, /schemeID="0002">848392017</);
  assert.match(xml, /schemeID="0009">12345678900012</);
  assert.match(xml, /schemeID="VA">FR48848392017</);
});

test("PDF/A-3 : XML joint, XMP Factur-X, profil sRGB, polices intégrées", async () => {
  const { pdf, xml } = await buildFacturXPdf(docs["facture-remise-2-taux"], loadAssets(), new Date("2026-09-30T10:00:00Z"));
  const text = Buffer.from(pdf).toString("latin1");
  assert.equal(text.slice(0, 5), "%PDF-");
  for (const needle of ["pdfaid:part>3<", "pdfaid:conformance>B<", "fx:ConformanceLevel>EN 16931<", "fx:DocumentFileName>factur-x.xml<", "/AFRelationship /Data", "factur-x.xml", "GTS_PDFA1", "/OutputIntents", "/FontFile2"]) {
    assert.ok(text.includes(needle), `absent : ${needle}`);
  }
  assert.ok(!text.includes("/BaseFont /Helvetica"), "aucune police standard non intégrée");
  assert.ok(xml.includes("F-2026-0017"));
});
