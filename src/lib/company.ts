export const COMPANY = {
  legalName: "Salis 3 Hottes",
  brand: "SalisCRM",
  tagline: "Nettoyage-Dégraissage",
  logoSrc: "/brand/logo-salis.png",
  addressLine: "12 rue de la Fontaine",
  postalCode: "75011",
  city: "Paris",
  country: "France",
  phone: "01 84 80 33 20",
  email: "contact@salis3hottes.fr",
  website: "www.salis3hottes.fr",
  siren: "848 392 017",
  siret: "848 392 017 00017",
  vatNumber: "FR48 848392017",
  vatRegime: "TVA sur les débits",
  capital: "10 000 €",
  rcs: "RCS Paris 848 392 017",
  ape: "8122Z",
  iban: "FR76 ACCT-000015 0000 123",
  bic: "SALSFRPP",
  bank: "Banque démo — non connectée",
  paymentTermsDefault: "Paiement à 30 jours date de facture",
  latePenaltyText: "Pénalités de retard : 3 × taux d’intérêt légal.",
  recoveryFeeText: "Indemnité forfaitaire de recouvrement : 40 €.",
  earlyPaymentText: "Escompte pour paiement anticipé : néant.",
  latePenalty: "Pénalités de retard : 3 × taux d’intérêt légal. Indemnité forfaitaire de recouvrement : 40 €.",
  quoteValidityDays: 30,
  defaultVatRate: 20,
  quotePrefix: "D",
  invoicePrefix: "F",
  interventionPrefix: "INT",
} as const;

export const OPERATING_ZONES = [
  "Paris",
  "Île-de-France",
  "Lyon",
  "Dijon",
  "Troyes",
] as const;

export type OperatingZone = (typeof OPERATING_ZONES)[number];

export function companyAddressBlock(): string {
  return `${COMPANY.legalName}\n${COMPANY.addressLine}\n${COMPANY.postalCode} ${COMPANY.city}\n${COMPANY.phone} · ${COMPANY.email}`;
}
