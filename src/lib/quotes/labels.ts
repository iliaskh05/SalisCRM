export const QUOTE_WORKFLOW_STATUSES = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "pending",
  "accepted",
  "rejected",
  "expired",
  "converted_intervention",
  "converted_invoice",
] as const;

export type QuoteWorkflowStatus = (typeof QUOTE_WORKFLOW_STATUSES)[number];

export const QUOTE_WORKFLOW_LABELS: Record<QuoteWorkflowStatus, string> = {
  draft: "Brouillon",
  ready: "Prêt à envoyer",
  sent: "Envoyé",
  viewed: "Consulté",
  pending: "En attente",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
  converted_intervention: "Converti en intervention",
  converted_invoice: "Converti en facture",
};

export const INTERVENTION_WORKFLOW_STATUSES = [
  "to_plan",
  "planned",
  "confirmed",
  "on_the_way",
  "started",
  "in_progress",
  "completed",
  "report_pending",
  "report_validated",
  "invoiced",
  "closed",
  "cancelled",
] as const;

export type InterventionWorkflowStatus = (typeof INTERVENTION_WORKFLOW_STATUSES)[number];

export const INTERVENTION_WORKFLOW_LABELS: Record<InterventionWorkflowStatus, string> = {
  to_plan: "À planifier",
  planned: "Planifiée",
  confirmed: "Confirmée",
  on_the_way: "Prestataire en route",
  started: "Démarrée",
  in_progress: "En cours",
  completed: "Terminée",
  report_pending: "Rapport à valider",
  report_validated: "Rapport validé",
  invoiced: "Facturée",
  closed: "Clôturée",
  cancelled: "Annulée",
};

export const E_INVOICE_STATUSES = ["draft", "ready", "submitted", "accepted", "rejected"] as const;
export type EInvoiceStatus = (typeof E_INVOICE_STATUSES)[number];

export const E_INVOICE_LABELS: Record<EInvoiceStatus, string> = {
  draft: "Brouillon",
  ready: "Prête pour transmission",
  submitted: "Soumise",
  accepted: "Acceptée",
  rejected: "Rejetée",
};

export const ACCOUNT_REQUEST_STATUSES = ["registered", "pending_approval", "approved", "active", "rejected"] as const;
export type AccountRequestStatus = (typeof ACCOUNT_REQUEST_STATUSES)[number];
