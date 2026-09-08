export type CatalogLike = {
  id: string;
  code: string | null;
  label: string;
  description: string | null;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  kind?: string;
};

export type SuggestedLine = {
  catalogId: string | null;
  label: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  kind: "service" | "travel" | "night" | "emergency" | "manual";
};

export type RequestFacts = {
  hoodLength?: string | null;
  hoodType?: string | null;
  filterCount?: number | null;
  filterType?: string | null;
  ductPresent?: boolean | null;
  ductLength?: string | null;
  motorPresent?: boolean | null;
  motorType?: string | null;
  nightIntervention?: boolean | null;
  urgency?: string | null;
  requestType?: string | null;
  maintenanceFrequency?: string | null;
  city?: string | null;
  message?: string | null;
};

function findCode(catalog: CatalogLike[], ...needles: string[]): CatalogLike | undefined {
  const upper = needles.map((n) => n.toUpperCase());
  return catalog.find((item) => {
    const code = (item.code ?? "").toUpperCase();
    const label = item.label.toUpperCase();
    return upper.some((n) => code.includes(n) || label.includes(n));
  });
}

function meters(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function lineFrom(item: CatalogLike, quantity: number, description: string, kind: SuggestedLine["kind"]): SuggestedLine {
  return {
    catalogId: item.id,
    label: item.label,
    description,
    unit: item.unit,
    quantity,
    unitPriceHt: item.unitPriceHt,
    vatRate: item.vatRate,
    kind,
  };
}

export function suggestQuoteLines(catalog: CatalogLike[], facts: RequestFacts): SuggestedLine[] {
  const lines: SuggestedLine[] = [];
  const hood = findCode(catalog, "HOTTE", "DEG-HOTTE");
  const filters = findCode(catalog, "FILTRE", "DEG-FILTRE");
  const duct = findCode(catalog, "CONDUIT", "DEG-CONDUIT");
  const motor = findCode(catalog, "MOTEUR", "DEG-MOTEUR");
  const night = findCode(catalog, "NIGHT", "NUIT");
  const urgent = findCode(catalog, "URG", "URGENCE");
  const travel = findCode(catalog, "TRAVEL", "DEPLAC");
  const contract = findCode(catalog, "CONTRACT", "ENT-TRIM", "MAINTENANCE", "PREV");

  if (hood) {
    const desc = [facts.hoodType, facts.hoodLength].filter(Boolean).join(" · ");
    lines.push(lineFrom(hood, 1, desc || "Hotte d’extraction", "service"));
  }
  if (filters && (facts.filterCount ?? 0) > 0) {
    lines.push(
      lineFrom(
        filters,
        facts.filterCount ?? 1,
        facts.filterType ? `${facts.filterCount} × ${facts.filterType}` : `${facts.filterCount} filtres`,
        "service",
      ),
    );
  }
  if (facts.ductPresent && duct) {
    const ml = meters(facts.ductLength);
    lines.push(lineFrom(duct, ml > 0 ? ml : 1, facts.ductLength ? `${facts.ductLength}` : "Conduits d’extraction", "service"));
  }
  if (facts.motorPresent && motor) {
    lines.push(lineFrom(motor, 1, facts.motorType || "Ventilateur / caisson", "service"));
  }
  if (facts.nightIntervention && night) {
    lines.push(lineFrom(night, 1, "Intervention de nuit demandée", "night"));
  }
  const urgency = (facts.urgency ?? "").toLowerCase();
  if ((urgency === "prioritaire" || urgency === "critique" || urgency === "urgent") && urgent) {
    lines.push(lineFrom(urgent, 1, `Urgence ${urgency}`, "emergency"));
  }
  if (travel) {
    lines.push(lineFrom(travel, 1, facts.city ? `Déplacement ${facts.city}` : "Déplacement", "travel"));
  }
  if ((facts.requestType === "contrat" || facts.requestType === "entretien_periodique") && contract) {
    lines.push(lineFrom(contract, 1, facts.maintenanceFrequency || "Entretien périodique", "service"));
  }

  return lines;
}

export function requestNotes(facts: RequestFacts & { company?: string | null }): string {
  const parts = [
    "Demande issue du formulaire site commercial.",
    facts.message ? `Message client : ${facts.message}` : null,
    facts.hoodLength || facts.hoodType ? `Installation : ${[facts.hoodType, facts.hoodLength].filter(Boolean).join(" ")}` : null,
    facts.filterCount ? `Filtres : ${facts.filterCount}${facts.filterType ? ` (${facts.filterType})` : ""}` : null,
    facts.ductPresent ? `Conduits : ${facts.ductLength || "présents"}` : null,
    facts.motorPresent ? `Moteur : ${facts.motorType || "présent"}` : null,
    facts.nightIntervention ? "Intervention de nuit souhaitée." : null,
    facts.urgency ? `Urgence : ${facts.urgency}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}
