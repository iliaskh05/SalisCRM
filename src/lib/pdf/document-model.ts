import { COMPANY } from "../company.ts";
import type { PaymentMethod, Tables } from "../supabase/types.ts";

/**
 * Modèle commun aux PDF de devis, factures et avoirs. Construit à partir des lignes
 * enregistrées en base : les montants imprimés sont ceux que la base a calculés
 * (source de vérité comptable), jamais recalculés côté navigateur.
 */

export type DocumentKind = "quote" | "invoice" | "credit_note";

export type DocumentLine = {
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  lineTotalHt: number;
};

export type DocumentClient = {
  name: string;
  contact?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  siret?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type VatRow = { rate: number; baseHt: number; vat: number };

export type DocumentPayment = { paidAt: string; method: PaymentMethod; amount: number; reference?: string | null };

export type BillingDocument = {
  kind: DocumentKind;
  reference: string;
  issuedAt: string;
  dueAt?: string | null;
  validUntil?: string | null;
  /** « Facture liée : F-2026-0001 », « Devis d'origine : D-2026-0004 »… */
  relatedLine?: string | null;
  /** Numéro de la facture annulée (avoir) : référence structurée du Factur-X */
  precedingInvoice?: string | null;
  /** Date d'émission de la facture annulée (obligatoire avec la référence, règle BR-FR-CO-05) */
  precedingInvoiceDate?: string | null;
  client: DocumentClient;
  /** Lieu d'intervention (devis) */
  siteLine?: string | null;
  lines: DocumentLine[];
  totals: { subtotalHt: number; discountHt: number; taxableHt: number; vatAmount: number; totalTtc: number };
  vatRows: VatRow[];
  /** Acompte prévu au devis */
  deposit?: number;
  payments?: DocumentPayment[];
  amountPaid?: number;
  amountDue?: number;
  notes?: string | null;
  paymentTerms?: string | null;
  /** Filigrane rouge (facture annulée) */
  watermark?: string | null;
  /** −1 pour un avoir : montants imprimés en négatif */
  sign: 1 | -1;
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Ventilation HT / TVA par taux (mention obligatoire sur une facture), avec la même
 * règle que la base : TVA d'une ligne = arrondi(HT ligne × part restante après remise × taux).
 * Les écarts d'arrondi de groupe sont reportés sur la dernière ligne pour que la somme
 * corresponde exactement aux totaux enregistrés.
 */
export function vatBreakdown(
  lines: Pick<DocumentLine, "lineTotalHt" | "vatRate">[],
  discountHt: number,
  target: { taxableHt: number; vatAmount: number },
): VatRow[] {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotalHt, 0));
  const ratio = subtotal > 0 ? (subtotal - discountHt) / subtotal : 1;

  const groups = new Map<number, VatRow>();
  for (const line of lines) {
    const row = groups.get(line.vatRate) ?? { rate: line.vatRate, baseHt: 0, vat: 0 };
    row.baseHt += line.lineTotalHt * ratio;
    row.vat += round2(line.lineTotalHt * ratio * (line.vatRate / 100));
    groups.set(line.vatRate, row);
  }

  const rows = [...groups.values()]
    .sort((a, b) => a.rate - b.rate)
    .map((r) => ({ rate: r.rate, baseHt: round2(r.baseHt), vat: round2(r.vat) }));

  const last = rows[rows.length - 1];
  if (last) {
    last.baseHt = round2(last.baseHt + target.taxableHt - rows.reduce((s, r) => s + r.baseHt, 0));
    last.vat = round2(last.vat + target.vatAmount - rows.reduce((s, r) => s + r.vat, 0));
  }
  return rows;
}

type RawLine = {
  label: string;
  description: string | null;
  quantity: number | string;
  unit_price_ht: number | string;
  vat_rate: number | string;
};

function toLines(items: RawLine[]): DocumentLine[] {
  return items.map((i) => {
    const quantity = Number(i.quantity);
    const unitPriceHt = Number(i.unit_price_ht);
    return {
      label: i.label,
      description: i.description,
      quantity,
      unitPriceHt,
      vatRate: Number(i.vat_rate),
      lineTotalHt: round2(quantity * unitPriceHt),
    };
  });
}

function toClient(c: {
  company_name: string;
  contact_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  siret?: string | null;
  email?: string | null;
  phone?: string | null;
} | null | undefined): DocumentClient {
  return {
    name: c?.company_name ?? "—",
    contact: c?.contact_name,
    address: c?.address,
    postalCode: c?.postal_code,
    city: c?.city,
    siret: c?.siret,
    email: c?.email,
    phone: c?.phone,
  };
}

function totalsOf(d: { subtotal_ht: number | string; discount_ht: number | string; vat_amount: number | string; total_ttc: number | string }) {
  const subtotalHt = Number(d.subtotal_ht);
  const discountHt = Math.min(Number(d.discount_ht) || 0, subtotalHt);
  return {
    subtotalHt,
    discountHt,
    taxableHt: round2(subtotalHt - discountHt),
    vatAmount: Number(d.vat_amount),
    totalTtc: Number(d.total_ttc),
  };
}

type ClientRow = Parameters<typeof toClient>[0];

export function quoteToDocument(input: {
  quote: Tables<"quotes">;
  items: Tables<"quote_items">[];
  client: ClientRow;
  siteLine?: string | null;
}): BillingDocument {
  const { quote } = input;
  const lines = toLines(input.items);
  const totals = totalsOf(quote);
  return {
    kind: "quote",
    reference: quote.reference ?? quote.id.slice(0, 8),
    issuedAt: quote.issued_at ?? quote.created_at.slice(0, 10),
    validUntil: quote.valid_until,
    client: toClient(input.client),
    siteLine: input.siteLine,
    lines,
    totals,
    vatRows: vatBreakdown(lines, totals.discountHt, totals),
    deposit: Number(quote.deposit_amount) || 0,
    notes: quote.notes,
    paymentTerms: quote.payment_terms,
    sign: 1,
  };
}

export function invoiceToDocument(input: {
  invoice: Tables<"invoices">;
  items: Tables<"invoice_items">[];
  client: ClientRow;
  payments: Tables<"payments">[];
  quoteReference?: string | null;
}): BillingDocument {
  const { invoice } = input;
  const lines = toLines(input.items);
  const totals = totalsOf(invoice);
  const amountPaid = round2(input.payments.reduce((s, p) => s + Number(p.amount), 0));
  const cancelled = invoice.status === "cancelled";
  return {
    kind: "invoice",
    reference: invoice.number ?? invoice.id.slice(0, 8),
    issuedAt: invoice.issued_at,
    dueAt: invoice.due_at,
    relatedLine: input.quoteReference ? `Devis d’origine : ${input.quoteReference}` : null,
    client: toClient(input.client),
    lines,
    totals,
    vatRows: vatBreakdown(lines, totals.discountHt, totals),
    payments: input.payments.map((p) => ({
      paidAt: p.paid_at,
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference,
    })),
    amountPaid,
    amountDue: cancelled ? 0 : Math.max(round2(totals.totalTtc - amountPaid), 0),
    notes: invoice.notes,
    watermark: cancelled ? "ANNULÉE" : null,
    sign: 1,
  };
}

export function creditNoteToDocument(input: {
  creditNote: Tables<"credit_notes">;
  client: ClientRow;
  invoiceNumber: string | null;
  invoiceIssuedAt?: string | null;
}): BillingDocument {
  const { creditNote } = input;
  const raw = Array.isArray(creditNote.lines) ? (creditNote.lines as unknown as RawLine[]) : [];
  const lines = toLines(raw);
  const totals = totalsOf(creditNote);
  return {
    kind: "credit_note",
    reference: creditNote.number,
    issuedAt: creditNote.issued_at,
    relatedLine: `Annule la facture ${input.invoiceNumber ?? "—"} — motif : ${creditNote.reason}`,
    precedingInvoice: input.invoiceNumber,
    precedingInvoiceDate: input.invoiceIssuedAt,
    client: toClient(input.client),
    lines,
    totals,
    vatRows: vatBreakdown(lines, totals.discountHt, totals),
    sign: -1,
  };
}

/** Contrôle de clé IBAN (mod 97) : on n'imprime jamais un IBAN de démonstration. */
export function isValidIban(iban: string): boolean {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

export function companyBankDetails(): { iban: string; bic: string } | null {
  return isValidIban(COMPANY.iban) ? { iban: COMPANY.iban, bic: COMPANY.bic } : null;
}

export function documentFileName(doc: Pick<BillingDocument, "kind" | "reference">): string {
  const prefix = { quote: "Devis", invoice: "Facture", credit_note: "Avoir" }[doc.kind];
  return `${prefix}-${doc.reference}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "-");
}
