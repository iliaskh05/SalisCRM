import type { LeadStatus } from "@/lib/supabase/types";

/** Cycle « demandes de devis » — mêmes valeurs que `lead_status` (table partagée avec le site). */
export const REQUEST_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "quote_requested",
  "quote_sent",
  "won",
  "lost",
] as const satisfies LeadStatus[];

export type QuoteRequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  new: "Nouvelle demande",
  contacted: "En revue",
  qualified: "Qualifiée",
  quote_requested: "Devis en préparation",
  quote_sent: "Devis envoyé",
  won: "Acceptée",
  lost: "Refusée",
};

export const REQUEST_STATUS_ORDER: QuoteRequestStatus[] = [...REQUEST_STATUSES];

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  hotel: "Hôtel",
  "fast-food": "Fast-food",
  fastfood: "Fast-food",
  bakery: "Boulangerie",
  boulangerie: "Boulangerie",
  pastry: "Pâtisserie",
  patisserie: "Pâtisserie",
  catering: "Traiteur",
  traiteur: "Traiteur",
  collective: "Cuisine collective",
  "cuisine collective": "Cuisine collective",
  other: "Autre",
};

export function businessTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const key = value.trim().toLowerCase();
  return BUSINESS_TYPE_LABELS[key] ?? value;
}

export const URGENCY_LABELS: Record<string, string> = {
  normal: "Normale",
  prioritaire: "Prioritaire",
  critique: "Critique",
  urgent: "Prioritaire",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  mensuelle: "Mensuelle",
  trimestrielle: "Trimestrielle",
  semestrielle: "Semestrielle",
  annuelle: "Annuelle",
  a_determiner: "À déterminer",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  ponctuelle: "Ponctuelle",
  entretien_periodique: "Entretien périodique",
  contrat: "Contrat",
};

export function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Oui" : "Non";
}
