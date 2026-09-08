import type { OperatingZone } from "@/lib/company";
import type {
  AccountRequestStatus,
  EInvoiceStatus,
  InterventionWorkflowStatus,
  QuoteWorkflowStatus,
} from "@/lib/quotes/labels";
import type { LineKind } from "@/lib/quotes/calculate";

export type DemoRole = "admin" | "commercial" | "prestataire";

export type DemoLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quote_requested"
  | "quote_sent"
  | "won"
  | "lost";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: DemoRole;
  status: AccountRequestStatus;
  requestedRole: DemoRole;
};

export type DemoRequestPhoto = {
  id: string;
  url: string;
  kind: "before" | "technical";
  name: string;
};

export type DemoLead = {
  id: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  zone: OperatingZone;
  siren: string;
  siret: string;
  businessType: string;
  source: string;
  status: DemoLeadStatus;
  value: number;
  note: string;
  hoodType: string;
  hoodLength: string;
  filterCount: number;
  convertedClientId: string | null;
  channel: "website" | "internal";
  consent: boolean;
  urgency: "normal" | "prioritaire" | "critique";
  requestType: string;
  maintenanceFrequency: string;
  lastCleaning: string;
  filterType: string;
  ductPresent: boolean;
  ductLength: string;
  motorPresent: boolean;
  motorType: string;
  accessibility: string;
  soilLevel: string;
  nightIntervention: boolean;
  schedulePreference: string;
  preferredContact: string;
  landingPage: string;
  photos: DemoRequestPhoto[];
  assignedUserId: string | null;
  quoteId: string | null;
  submittedAt: string;
};

export type DemoClient = {
  id: string;
  leadId: string | null;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  zone: OperatingZone;
  siren: string;
  siret: string;
  businessType: string;
  notes: string;
  contract: string;
  since: string;
  commercialId: string;
};

export type DemoInstallation = {
  id: string;
  clientId: string;
  label: string;
  hoodType: string;
  hoodLength: string;
  filterCount: number;
  filterType: string;
  ductPresent: boolean;
  ductLength: string;
  ductAccessibility: string;
  motorPresent: boolean;
  motorType: string;
  motorAccessibility: string;
  soilLevel: string;
  nightIntervention: boolean;
  schedulePreferences: string;
  remarks: string;
};

export type DemoCatalogItem = {
  id: string;
  code: string;
  label: string;
  description: string;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  kind: LineKind;
  suggested: boolean;
};

export type DemoQuoteLine = {
  id: string;
  quoteId: string;
  catalogId: string | null;
  label: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  kind: LineKind;
  position: number;
};

export type DemoQuote = {
  id: string;
  reference: string;
  clientId: string;
  leadId: string | null;
  installationId: string | null;
  commercialId: string;
  status: QuoteWorkflowStatus;
  issuedAt: string;
  validUntil: string;
  notes: string;
  paymentTerms: string;
  discountHt: number;
  depositAmount: number;
  interventionId: string | null;
  invoiceId: string | null;
  createdAt: string;
};

export type DemoProvider = {
  id: string;
  userId: string | null;
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  zone: OperatingZone;
  specialty: string;
  costRate: number;
  status: "active" | "inactive";
};

export type DemoIntervention = {
  id: string;
  reference: string;
  clientId: string;
  installationId: string | null;
  quoteId: string | null;
  providerId: string | null;
  city: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  service: string;
  status: InterventionWorkflowStatus;
  amountTtc: number;
  description: string;
  notes: string;
  invoiceId: string | null;
};

export type DemoPhoto = {
  id: string;
  interventionId: string;
  clientId: string;
  kind: "before" | "after" | "technical";
  url: string;
  comment: string;
  uploader: string;
  createdAt: string;
};

export type DemoProduct = {
  id: string;
  interventionId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  notes: string;
};

export type DemoReport = {
  id: string;
  interventionId: string;
  workCompleted: string;
  observations: string;
  difficulties: string;
  recommendations: string;
  checklist: Record<string, boolean>;
  providerSignature: string | null;
  clientSignature: string | null;
  validatedAt: string | null;
};

export type DemoInvoice = {
  id: string;
  number: string;
  clientId: string;
  quoteId: string | null;
  interventionId: string | null;
  issuedAt: string;
  dueAt: string;
  notes: string;
  paymentTerms: string;
  eStatus: EInvoiceStatus;
  cancelled: boolean;
};

export type DemoInvoiceLine = {
  id: string;
  invoiceId: string;
  label: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  position: number;
};

export type DemoPayment = {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  paidAt: string;
  method: "transfer" | "card" | "check" | "cash" | "other";
  reference: string;
  note: string;
};

export type DemoActivity = {
  id: string;
  clientId: string | null;
  leadId: string | null;
  type: string;
  title: string;
  description: string;
  createdAt: string;
};

export type DemoDocument = {
  id: string;
  clientId: string;
  title: string;
  type: "quote" | "invoice" | "report" | "contract" | "customer" | "technical" | "photo" | "other";
  date: string;
  uploader: string;
  size: string;
  url: string;
};

export type DemoConversation = {
  id: string;
  title: string;
  kind: "direct" | "group" | "intervention";
  interventionId: string | null;
  memberIds: string[];
};

export type DemoMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  kind: "text" | "image" | "pdf" | "file" | "audio";
  attachmentName?: string;
  attachmentUrl?: string;
  createdAt: string;
  readBy: string[];
};

export type DemoNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
  role: DemoRole | "all";
};

export type DemoSettings = {
  quoteValidityDays: number;
  defaultVat: number;
  paymentTerms: string;
  quotePrefix: string;
  invoicePrefix: string;
};

export type DemoState = {
  version: number;
  sessionUserId: string | null;
  remember: boolean;
  users: DemoUser[];
  leads: DemoLead[];
  clients: DemoClient[];
  installations: DemoInstallation[];
  catalog: DemoCatalogItem[];
  quotes: DemoQuote[];
  quoteLines: DemoQuoteLine[];
  providers: DemoProvider[];
  interventions: DemoIntervention[];
  photos: DemoPhoto[];
  products: DemoProduct[];
  reports: DemoReport[];
  invoices: DemoInvoice[];
  invoiceLines: DemoInvoiceLine[];
  payments: DemoPayment[];
  activities: DemoActivity[];
  documents: DemoDocument[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
  notifications: DemoNotification[];
  settings: DemoSettings;
  quoteSeq: number;
  invoiceSeq: number;
  interventionSeq: number;
};
