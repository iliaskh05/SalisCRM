import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Même règle que Supabase Auth (minimum 10, minuscules + majuscules + chiffres). */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "10 caractères minimum")
      .regex(/[a-z]/, "Au moins une minuscule")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });

export const leadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "quote_requested",
  "quote_sent",
  "won",
  "lost",
]);

export const clientStatusSchema = z.enum(["active", "inactive", "archived"]);
export const interventionStatusSchema = z.enum([
  "to_plan",
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);
export const quoteStatusSchema = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);
export const invoiceStatusSchema = z.enum(["unpaid", "partially_paid", "paid", "overdue", "cancelled"]);
export const paymentMethodSchema = z.enum(["cash", "transfer", "card", "check", "other"]);
export const photoKindSchema = z.enum(["before", "after", "technical"]);
export const providerStatusSchema = z.enum(["active", "inactive"]);
export const documentTypeSchema = z.enum(["quote", "invoice", "report", "contract", "photo", "other"]);

export const moneySchema = z.number().finite().nonnegative();

const optionalEmail = z
  .string()
  .trim()
  .email("Email invalide")
  .optional()
  .nullable()
  .or(z.literal(""));

export const clientCreateSchema = z.object({
  company_name: z.string().trim().min(1, "Raison sociale obligatoire"),
  contact_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: optionalEmail,
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  postal_code: z.string().trim().optional().nullable(),
  siret: z.string().trim().optional().nullable(),
  business_type: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  next_action: z.string().trim().optional().nullable(),
  next_action_date: z.string().optional().nullable(),
  status: clientStatusSchema.default("active"),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const leadUpdateSchema = z.object({
  status: leadStatusSchema,
  priority: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  next_action: z.string().optional().nullable(),
  next_action_date: z.string().optional().nullable(),
  assigned_user: z.string().optional().nullable(),
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const installationSchema = z.object({
  label: z.string().optional().nullable(),
  hood_length: z.string().optional().nullable(),
  hood_type: z.string().optional().nullable(),
  filter_count: z.coerce.number().int().nonnegative().optional().nullable(),
  filter_type: z.string().optional().nullable(),
  duct_present: z.boolean().optional().nullable(),
  duct_length: z.string().optional().nullable(),
  duct_accessibility: z.string().optional().nullable(),
  motor_present: z.boolean().optional().nullable(),
  motor_type: z.string().optional().nullable(),
  motor_accessibility: z.string().optional().nullable(),
  night_intervention: z.boolean().optional().nullable(),
  schedule_preference: z.string().optional().nullable(),
  soil_level: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type InstallationInput = z.infer<typeof installationSchema>;

export const interventionSchema = z.object({
  client_id: z.string().uuid("Client obligatoire"),
  provider_id: z.string().uuid().optional().nullable().or(z.literal("")),
  scheduled_date: z.string().optional().nullable(),
  time_slot: z.string().optional().nullable(),
  service_type: z.string().optional().nullable(),
  status: interventionStatusSchema.default("to_plan"),
  description: z.string().optional().nullable(),
  price_ht: z.coerce.number().finite().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InterventionInput = z.infer<typeof interventionSchema>;

export const quoteItemSchema = z.object({
  label: z.string().trim().min(1, "Libellé obligatoire"),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantité invalide"),
  unit_price_ht: z.coerce.number().finite().nonnegative(),
  vat_rate: z.coerce.number().finite().nonnegative().default(20),
  service_catalog_id: z.string().uuid().optional().nullable(),
});

export const quoteCreateSchema = z.object({
  client_id: z.string().uuid("Client obligatoire"),
  lead_id: z.string().uuid().optional().nullable().or(z.literal("")),
  status: quoteStatusSchema.default("draft"),
  issued_at: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1, "Ajoutez au moins une ligne"),
});

export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;

export const invoiceCreateSchema = z.object({
  client_id: z.string().uuid("Client obligatoire"),
  quote_id: z.string().uuid().optional().nullable().or(z.literal("")),
  issued_at: z.string().min(1, "Date d'émission obligatoire"),
  due_at: z.string().optional().nullable(),
  status: invoiceStatusSchema.default("unpaid"),
  notes: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1, "Ajoutez au moins une ligne"),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const paymentCreateSchema = z.object({
  invoice_id: z.string().uuid("Facture obligatoire"),
  client_id: z.string().uuid("Client obligatoire"),
  amount: z.coerce.number().positive("Montant invalide"),
  paid_at: z.string().min(1, "Date obligatoire"),
  method: paymentMethodSchema,
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire"),
  company_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: optionalEmail,
  city: z.string().optional().nullable(),
  intervention_zone: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  cost_rate: z.coerce.number().finite().nonnegative().optional().nullable(),
  status: providerStatusSchema.default("active"),
  notes: z.string().optional().nullable(),
});

export type ProviderInput = z.infer<typeof providerSchema>;
