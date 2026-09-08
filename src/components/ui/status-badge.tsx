import { Badge } from "@/components/ui/badge";
import {
  CLIENT_STATUS_LABELS,
  INTERVENTION_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
} from "@/lib/constants";
import type {
  ClientStatus,
  InterventionStatus,
  InvoiceStatus,
  LeadStatus,
  QuoteStatus,
} from "@/lib/supabase/types";

type Tone = "default" | "accent" | "success" | "warning" | "danger" | "outline";

const LEAD_TONE: Record<LeadStatus, Tone> = {
  new: "accent",
  contacted: "default",
  qualified: "accent",
  quote_requested: "warning",
  quote_sent: "warning",
  won: "success",
  lost: "danger",
};

const CLIENT_TONE: Record<ClientStatus, Tone> = {
  active: "success",
  inactive: "default",
  archived: "outline",
};

const INTERVENTION_TONE: Record<InterventionStatus, Tone> = {
  to_plan: "warning",
  planned: "accent",
  in_progress: "accent",
  completed: "success",
  cancelled: "danger",
};

const QUOTE_TONE: Record<QuoteStatus, Tone> = {
  draft: "default",
  sent: "accent",
  accepted: "success",
  rejected: "danger",
  expired: "warning",
};

const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  unpaid: "warning",
  partially_paid: "accent",
  paid: "success",
  overdue: "danger",
  cancelled: "outline",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={LEAD_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={CLIENT_TONE[status]}>{CLIENT_STATUS_LABELS[status]}</Badge>;
}

export function InterventionStatusBadge({ status }: { status: InterventionStatus }) {
  return <Badge variant={INTERVENTION_TONE[status]}>{INTERVENTION_STATUS_LABELS[status]}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={QUOTE_TONE[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={INVOICE_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
