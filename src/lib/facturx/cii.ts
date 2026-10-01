import { COMPANY } from "../company.ts";
import { companyBankDetails, round2, type BillingDocument } from "../pdf/document-model.ts";

/**
 * XML Factur-X (syntaxe UN/CEFACT CII D16B), profil « EN 16931 ».
 *
 * Les montants sont ceux enregistrés en base (jamais recalculés). Un avoir est émis avec le
 * code 381 et des montants POSITIFS, comme l'exige la norme (le PDF, lui, les affiche en négatif).
 *
 * Non couvert : les mentions propres à la réforme française de la facturation électronique
 * (catégorie d'opération, adresse de livraison…) qui dépendent de la plateforme agréée choisie.
 */

const NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
  xs: "http://www.w3.org/2001/XMLSchema",
};

export const FACTURX_GUIDELINE = "urn:cen.eu:en16931:2017";

const esc = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: number) => Math.abs(round2(n)).toFixed(2);
const quantity = (n: number) => (Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-9 ? n.toFixed(2) : n.toFixed(4));
const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const tag = (name: string, value: string, attrs = "") => `<${name}${attrs}>${esc(value)}</${name}>`;

/** TVA à 0 % : « exonérée » (E) avec motif obligatoire ; sinon taux normal (S). */
const vatCategory = (rate: number) => (rate > 0 ? "S" : "E");

function taxBlock(rate: number, indent: string): string {
  return [
    `${indent}<ram:TypeCode>VAT</ram:TypeCode>`,
    `${indent}<ram:CategoryCode>${vatCategory(rate)}</ram:CategoryCode>`,
    `${indent}<ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>`,
  ].join("\n");
}

function party(p: {
  name: string;
  legalId?: { scheme: string; value: string } | null;
  address: { line?: string | null; postcode?: string | null; city?: string | null };
  email?: string | null;
  vatId?: string | null;
}): string {
  const out: string[] = [`        ${tag("ram:Name", p.name)}`];
  if (p.legalId) {
    out.push(`        <ram:SpecifiedLegalOrganization>`, `          ${tag("ram:ID", p.legalId.value, ` schemeID="${p.legalId.scheme}"`)}`, `        </ram:SpecifiedLegalOrganization>`);
  }
  out.push(`        <ram:PostalTradeAddress>`);
  if (p.address.postcode) out.push(`          ${tag("ram:PostcodeCode", p.address.postcode)}`);
  if (p.address.line) out.push(`          ${tag("ram:LineOne", p.address.line)}`);
  if (p.address.city) out.push(`          ${tag("ram:CityName", p.address.city)}`);
  out.push(`          <ram:CountryID>FR</ram:CountryID>`, `        </ram:PostalTradeAddress>`);
  if (p.email) {
    out.push(`        <ram:URIUniversalCommunication>`, `          ${tag("ram:URIID", p.email, ` schemeID="EM"`)}`, `        </ram:URIUniversalCommunication>`);
  }
  if (p.vatId) {
    out.push(`        <ram:SpecifiedTaxRegistration>`, `          ${tag("ram:ID", p.vatId, ` schemeID="VA"`)}`, `        </ram:SpecifiedTaxRegistration>`);
  }
  return out.join("\n");
}

export function buildFacturXml(doc: BillingDocument): string {
  if (doc.kind === "quote") throw new Error("Un devis n'est pas une facture : pas de Factur-X.");
  const isCredit = doc.kind === "credit_note";
  const t = doc.totals;

  // --- notes : mentions légales françaises (codes de sujet PMD / PMT / AAB / TXD) ---
  // Obligatoires sur les factures ET les avoirs (BR-FR-05)
  const notes: { text: string; code?: string }[] = [
    { text: COMPANY.latePenaltyText, code: "PMD" },
    { text: COMPANY.recoveryFeeText, code: "PMT" },
    { text: COMPANY.earlyPaymentText, code: "AAB" },
    { text: COMPANY.vatRegime, code: "TXD" },
  ];
  if (doc.relatedLine && isCredit) notes.push({ text: doc.relatedLine, code: "AAI" });
  if (doc.notes?.trim()) notes.push({ text: doc.notes.trim(), code: "AAI" });

  // --- lignes ---
  const lines = doc.lines
    .map((l, i) => {
      const rate = l.vatRate;
      return [
        `    <ram:IncludedSupplyChainTradeLineItem>`,
        `      <ram:AssociatedDocumentLineDocument>`,
        `        <ram:LineID>${i + 1}</ram:LineID>`,
        `      </ram:AssociatedDocumentLineDocument>`,
        `      <ram:SpecifiedTradeProduct>`,
        `        ${tag("ram:Name", l.label)}`,
        ...(l.description?.trim() ? [`        ${tag("ram:Description", l.description.trim())}`] : []),
        `      </ram:SpecifiedTradeProduct>`,
        `      <ram:SpecifiedLineTradeAgreement>`,
        `        <ram:NetPriceProductTradePrice>`,
        `          <ram:ChargeAmount>${money(l.unitPriceHt)}</ram:ChargeAmount>`,
        `        </ram:NetPriceProductTradePrice>`,
        `      </ram:SpecifiedLineTradeAgreement>`,
        `      <ram:SpecifiedLineTradeDelivery>`,
        `        <ram:BilledQuantity unitCode="C62">${quantity(l.quantity)}</ram:BilledQuantity>`,
        `      </ram:SpecifiedLineTradeDelivery>`,
        `      <ram:SpecifiedLineTradeSettlement>`,
        `        <ram:ApplicableTradeTax>`,
        taxBlock(rate, "          "),
        `        </ram:ApplicableTradeTax>`,
        `        <ram:SpecifiedTradeSettlementLineMonetarySummation>`,
        `          <ram:LineTotalAmount>${money(l.lineTotalHt)}</ram:LineTotalAmount>`,
        `        </ram:SpecifiedTradeSettlementLineMonetarySummation>`,
        `      </ram:SpecifiedLineTradeSettlement>`,
        `    </ram:IncludedSupplyChainTradeLineItem>`,
      ].join("\n");
    })
    .join("\n");

  // --- remise : une remise de document par taux de TVA (la norme exige la catégorie de TVA) ---
  const lineSumByRate = new Map<number, number>();
  for (const l of doc.lines) lineSumByRate.set(l.vatRate, round2((lineSumByRate.get(l.vatRate) ?? 0) + l.lineTotalHt));
  const allowances = doc.vatRows
    .map((r) => ({ rate: r.rate, amount: round2((lineSumByRate.get(r.rate) ?? 0) - r.baseHt) }))
    .filter((a) => a.amount > 0);

  const vatRows = doc.vatRows
    .map((r) =>
      [
        `      <ram:ApplicableTradeTax>`,
        `        <ram:CalculatedAmount>${money(r.vat)}</ram:CalculatedAmount>`,
        `        <ram:TypeCode>VAT</ram:TypeCode>`,
        ...(vatCategory(r.rate) === "E" ? [`        ${tag("ram:ExemptionReason", "Exonération de TVA")}`] : []),
        `        <ram:BasisAmount>${money(r.baseHt)}</ram:BasisAmount>`,
        `        <ram:CategoryCode>${vatCategory(r.rate)}</ram:CategoryCode>`,
        `        <ram:RateApplicablePercent>${r.rate.toFixed(2)}</ram:RateApplicablePercent>`,
        `      </ram:ApplicableTradeTax>`,
      ].join("\n"),
    )
    .join("\n");

  const allowanceXml = allowances
    .map((a) =>
      [
        `      <ram:SpecifiedTradeAllowanceCharge>`,
        `        <ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>`,
        `        <ram:ActualAmount>${money(a.amount)}</ram:ActualAmount>`,
        `        ${tag("ram:Reason", "Remise")}`,
        `        <ram:CategoryTradeTax>`,
        taxBlock(a.rate, "          "),
        `        </ram:CategoryTradeTax>`,
        `      </ram:SpecifiedTradeAllowanceCharge>`,
      ].join("\n"),
    )
    .join("\n");

  // --- règlement ---
  const bank = companyBankDetails();
  const paymentMeans = bank
    ? [
        `      <ram:SpecifiedTradeSettlementPaymentMeans>`,
        `        <ram:TypeCode>30</ram:TypeCode>`,
        `        <ram:PayeePartyCreditorFinancialAccount>`,
        `          ${tag("ram:IBANID", bank.iban.replace(/\s+/g, ""))}`,
        `        </ram:PayeePartyCreditorFinancialAccount>`,
        `        <ram:PayeeSpecifiedCreditorFinancialInstitution>`,
        `          ${tag("ram:BICID", bank.bic.replace(/\s+/g, ""))}`,
        `        </ram:PayeeSpecifiedCreditorFinancialInstitution>`,
        `      </ram:SpecifiedTradeSettlementPaymentMeans>`,
      ].join("\n")
    : "";

  const paymentTerms = isCredit
    ? ""
    : [
        `      <ram:SpecifiedTradePaymentTerms>`,
        `        ${tag("ram:Description", doc.paymentTerms?.trim() || COMPANY.paymentTermsDefault)}`,
        ...(doc.dueAt ? [`        <ram:DueDateDateTime><udt:DateTimeString format="102">${ymd(doc.dueAt)}</udt:DateTimeString></ram:DueDateDateTime>`] : []),
        `      </ram:SpecifiedTradePaymentTerms>`,
      ].join("\n");

  const prepaid = isCredit ? 0 : round2((doc.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const due = round2(Math.abs(t.totalTtc) - prepaid);

  const buyerDigits = digits(doc.client.siret);
  const buyerLegalId =
    buyerDigits.length === 14 ? { scheme: "0009", value: buyerDigits } : buyerDigits.length === 9 ? { scheme: "0002", value: buyerDigits } : null;

  const seller = party({
    name: COMPANY.legalName,
    legalId: { scheme: "0002", value: digits(COMPANY.siren) },
    address: { line: COMPANY.addressLine, postcode: COMPANY.postalCode, city: COMPANY.city },
    email: COMPANY.email,
    vatId: COMPANY.vatNumber.replace(/\s+/g, ""),
  });
  const buyer = party({
    name: doc.client.name,
    legalId: buyerLegalId,
    address: { line: doc.client.address, postcode: doc.client.postalCode, city: doc.client.city },
    email: doc.client.email,
  });

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rsm:CrossIndustryInvoice xmlns:rsm="${NS.rsm}" xmlns:qdt="${NS.qdt}" xmlns:ram="${NS.ram}" xmlns:xs="${NS.xs}" xmlns:udt="${NS.udt}">`,
    `  <rsm:ExchangedDocumentContext>`,
    `    <ram:GuidelineSpecifiedDocumentContextParameter>`,
    `      <ram:ID>${FACTURX_GUIDELINE}</ram:ID>`,
    `    </ram:GuidelineSpecifiedDocumentContextParameter>`,
    `  </rsm:ExchangedDocumentContext>`,
    `  <rsm:ExchangedDocument>`,
    `    ${tag("ram:ID", doc.reference)}`,
    `    <ram:TypeCode>${isCredit ? "381" : "380"}</ram:TypeCode>`,
    `    <ram:IssueDateTime><udt:DateTimeString format="102">${ymd(doc.issuedAt)}</udt:DateTimeString></ram:IssueDateTime>`,
    ...notes.map((n) => `    <ram:IncludedNote>\n      ${tag("ram:Content", n.text)}${n.code ? `\n      ${tag("ram:SubjectCode", n.code)}` : ""}\n    </ram:IncludedNote>`),
    `  </rsm:ExchangedDocument>`,
    `  <rsm:SupplyChainTradeTransaction>`,
    lines,
    `    <ram:ApplicableHeaderTradeAgreement>`,
    `      <ram:SellerTradeParty>`,
    seller,
    `      </ram:SellerTradeParty>`,
    `      <ram:BuyerTradeParty>`,
    buyer,
    `      </ram:BuyerTradeParty>`,
    `    </ram:ApplicableHeaderTradeAgreement>`,
    // Livraison : destinataire seulement (la date de prestation n'est pas connue de la facture)
    `    <ram:ApplicableHeaderTradeDelivery>`,
    `      <ram:ShipToTradeParty>`,
    `        ${tag("ram:Name", doc.client.name)}`,
    `      </ram:ShipToTradeParty>`,
    `    </ram:ApplicableHeaderTradeDelivery>`,
    `    <ram:ApplicableHeaderTradeSettlement>`,
    `      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>`,
    paymentMeans,
    vatRows,
    allowanceXml,
    paymentTerms,
    `      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>`,
    `        <ram:LineTotalAmount>${money(t.subtotalHt)}</ram:LineTotalAmount>`,
    ...(t.discountHt > 0 ? [`        <ram:AllowanceTotalAmount>${money(t.discountHt)}</ram:AllowanceTotalAmount>`] : []),
    `        <ram:TaxBasisTotalAmount>${money(t.taxableHt)}</ram:TaxBasisTotalAmount>`,
    `        <ram:TaxTotalAmount currencyID="EUR">${money(t.vatAmount)}</ram:TaxTotalAmount>`,
    `        <ram:GrandTotalAmount>${money(t.totalTtc)}</ram:GrandTotalAmount>`,
    ...(prepaid > 0 ? [`        <ram:TotalPrepaidAmount>${money(prepaid)}</ram:TotalPrepaidAmount>`] : []),
    `        <ram:DuePayableAmount>${money(due)}</ram:DuePayableAmount>`,
    `      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>`,
    ...(isCredit && doc.precedingInvoice
      ? [
          `      <ram:InvoiceReferencedDocument>\n        ${tag("ram:IssuerAssignedID", doc.precedingInvoice)}${
            doc.precedingInvoiceDate
              ? `\n        <ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${ymd(doc.precedingInvoiceDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime>`
              : ""
          }\n      </ram:InvoiceReferencedDocument>`,
        ]
      : []),
    `    </ram:ApplicableHeaderTradeSettlement>`,
    `  </rsm:SupplyChainTradeTransaction>`,
    `</rsm:CrossIndustryInvoice>`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return `${xml}\n`;
}
