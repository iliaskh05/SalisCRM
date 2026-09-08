/** Centralized quote / invoice arithmetic. Never reimplement totals in UI. */

export type LineKind = "service" | "manual" | "travel" | "night" | "emergency" | "discount";

export type QuoteLineInput = {
  id?: string;
  label: string;
  description?: string;
  unit?: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  kind?: LineKind;
};

export type QuoteLineComputed = {
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  lineTotalHt: number;
  lineVat: number;
  lineTotalTtc: number;
};

export type QuoteTotals = {
  lines: QuoteLineComputed[];
  subtotalHt: number;
  discountHt: number;
  taxableHt: number;
  vatAmount: number;
  totalTtc: number;
  deposit: number;
  remaining: number;
};

export type QuoteCalcOptions = {
  discountHt?: number;
  depositAmount?: number;
  depositRate?: number;
};

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

function sanitizeVat(rate: number): number {
  if (!Number.isFinite(rate)) return 20;
  if (rate < 0) return 0;
  if (rate > 100) return 100;
  return rate;
}

export function sanitizeLine(input: QuoteLineInput): QuoteLineComputed {
  const quantity = clampNonNegative(Number(input.quantity));
  const unitPriceHt = clampNonNegative(Number(input.unitPriceHt));
  const vatRate = sanitizeVat(Number(input.vatRate));
  const lineTotalHt = money(quantity * unitPriceHt);
  const lineVat = money(lineTotalHt * (vatRate / 100));
  return {
    quantity,
    unitPriceHt: money(unitPriceHt),
    vatRate,
    lineTotalHt,
    lineVat,
    lineTotalTtc: money(lineTotalHt + lineVat),
  };
}

/**
 * French commercial quote:
 * line HT = qty × PU HT
 * subtotal HT = sum(line HT)
 * discount HT applied on HT
 * VAT computed proportionally on remaining taxable HT per line
 * TTC = taxable HT + VAT
 */
export function calculateQuote(lines: QuoteLineInput[], options: QuoteCalcOptions = {}): QuoteTotals {
  const computed = lines.map(sanitizeLine);
  const subtotalHt = money(computed.reduce((sum, line) => sum + line.lineTotalHt, 0));
  const discountHt = money(Math.min(clampNonNegative(Number(options.discountHt ?? 0)), subtotalHt));
  const taxableHt = money(subtotalHt - discountHt);
  const ratio = subtotalHt > 0 ? taxableHt / subtotalHt : 1;

  const vatAmount = money(
    computed.reduce((sum, line) => sum + money(line.lineTotalHt * ratio * (line.vatRate / 100)), 0),
  );
  const totalTtc = money(taxableHt + vatAmount);

  let deposit = 0;
  if (options.depositAmount != null && Number.isFinite(options.depositAmount)) {
    deposit = money(clampNonNegative(options.depositAmount));
  } else if (options.depositRate != null && Number.isFinite(options.depositRate)) {
    deposit = money(totalTtc * (clampNonNegative(options.depositRate) / 100));
  }
  deposit = Math.min(deposit, totalTtc);

  return {
    lines: computed,
    subtotalHt,
    discountHt,
    taxableHt,
    vatAmount,
    totalTtc,
    deposit,
    remaining: money(totalTtc - deposit),
  };
}

export function lineTotalHt(quantity: number, unitPriceHt: number): number {
  return sanitizeLine({
    label: "",
    quantity,
    unitPriceHt,
    vatRate: 0,
  }).lineTotalHt;
}

export function productCost(quantity: number, unitCost: number): number {
  return money(clampNonNegative(quantity) * clampNonNegative(unitCost));
}

export function estimatedMargin(params: {
  sellingPriceTtc: number;
  providerCost: number;
  productCost: number;
  otherCosts?: number;
}): { margin: number; marginRate: number } {
  const selling = clampNonNegative(params.sellingPriceTtc);
  const costs =
    clampNonNegative(params.providerCost) +
    clampNonNegative(params.productCost) +
    clampNonNegative(params.otherCosts ?? 0);
  const margin = money(selling - costs);
  const marginRate = selling > 0 ? money((margin / selling) * 100) : 0;
  return { margin, marginRate };
}

export const DEFAULT_PAYMENT_TERMS =
  "Acompte de 30 % à la commande. Solde à 30 jours date de facture. Escompte pour paiement anticipé : néant.";
