import type {
  ActivityType,
  ClientStatus,
  DocumentType,
  InterventionStatus,
  InvoiceStatus,
  LeadStatus,
  PaymentMethod,
  PhotoKind,
  ProviderStatus,
  QuoteStatus,
} from "@/lib/supabase/types";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  quote_requested: "Devis demandé",
  quote_sent: "Devis envoyé",
  won: "Gagné",
  lost: "Perdu",
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  archived: "Archivé",
};

export const INTERVENTION_STATUS_LABELS: Record<InterventionStatus, string> = {
  to_plan: "À planifier",
  planned: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Impayée",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  transfer: "Virement",
  card: "Carte",
  check: "Chèque",
  other: "Autre",
};

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  before: "Avant",
  after: "Après",
  technical: "Technique",
};

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quote: "Devis",
  invoice: "Facture",
  report: "Rapport",
  contract: "Contrat",
  photo: "Photo",
  other: "Autre",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CLIENT_CREATED: "Client créé",
  QUOTE_CREATED: "Devis créé",
  QUOTE_SENT: "Devis envoyé",
  QUOTE_ACCEPTED: "Devis accepté",
  INTERVENTION_CREATED: "Intervention créée",
  INTERVENTION_COMPLETED: "Intervention terminée",
  PHOTO_UPLOADED: "Photo ajoutée",
  INVOICE_CREATED: "Facture créée",
  PAYMENT_RECEIVED: "Paiement reçu",
  LEAD_CONVERTED: "Prospect converti",
  NOTE_ADDED: "Note ajoutée",
  STATUS_CHANGED: "Statut modifié",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  urgent: "Urgente",
};

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const STORAGE_BUCKETS = {
  interventionPhotos: "intervention-photos",
  clientDocuments: "client-documents",
  leadDocuments: "lead-documents",
} as const;
