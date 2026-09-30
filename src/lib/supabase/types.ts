export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StaffRole = "admin" | "commercial" | "prestataire";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quote_requested"
  | "quote_sent"
  | "won"
  | "lost";

export type ClientStatus = "active" | "inactive" | "archived";
export type InterventionStatus = "to_plan" | "planned" | "in_progress" | "completed" | "cancelled";
export type PhotoKind = "before" | "after" | "technical";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type InvoiceStatus = "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "card" | "check" | "other";
export type ProviderStatus = "active" | "inactive";
export type DocumentType = "quote" | "invoice" | "report" | "contract" | "photo" | "other";
export type ActivityType =
  | "CLIENT_CREATED"
  | "QUOTE_CREATED"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "INTERVENTION_CREATED"
  | "INTERVENTION_COMPLETED"
  | "PHOTO_UPLOADED"
  | "INVOICE_CREATED"
  | "PAYMENT_RECEIVED"
  | "LEAD_CONVERTED"
  | "NOTE_ADDED"
  | "STATUS_CHANGED";

export type Database = {
  public: {
    Tables: {
      staff_profiles: {
        Row: {
          user_id: string;
          role: StaffRole;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: StaffRole;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: StaffRole;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          company_name: string | null;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          business_type: string | null;
          city: string | null;
          postal_code: string | null;
          hood_length: string | null;
          filter_count: number | null;
          duct_present: boolean | null;
          motor_present: boolean | null;
          last_cleaning: string | null;
          requested_frequency: string | null;
          photos: Json;
          message: string | null;
          source: string;
          status: LeadStatus;
          created_at: string;
          updated_at: string;
          reference: string | null;
          consent: boolean | null;
          preferred_contact: string | null;
          assigned_user: string | null;
          notes: string | null;
          priority: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          need_type: string | null;
          installation_type: string | null;
          hood_type: string | null;
          duct_length: string | null;
          soil_level: string | null;
          accessibility: string | null;
          night_intervention: boolean | null;
          schedule_preference: string | null;
          request_type: string | null;
          maintenance_frequency: string | null;
          urgency_level: string | null;
          landing_page: string | null;
          service_source: string | null;
          zone_source: string | null;
          last_intervention_at: string | null;
          next_due_at: string | null;
          next_action: string | null;
          next_action_date: string | null;
          converted_client_id: string | null;
          address: string | null;
          filter_type: string | null;
          motor_type: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          reference: string | null;
          lead_id: string | null;
          company_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          siret: string | null;
          business_type: string | null;
          status: ClientStatus;
          notes: string | null;
          next_action: string | null;
          next_action_date: string | null;
          assigned_user: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string | null;
          lead_id?: string | null;
          company_name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          siret?: string | null;
          business_type?: string | null;
          status?: ClientStatus;
          notes?: string | null;
          next_action?: string | null;
          next_action_date?: string | null;
          assigned_user?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_installations: {
        Row: {
          id: string;
          client_id: string;
          label: string | null;
          hood_length: string | null;
          hood_type: string | null;
          filter_count: number | null;
          filter_type: string | null;
          duct_present: boolean | null;
          duct_length: string | null;
          duct_accessibility: string | null;
          motor_present: boolean | null;
          motor_type: string | null;
          motor_accessibility: string | null;
          night_intervention: boolean | null;
          schedule_preference: string | null;
          soil_level: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      providers: {
        Row: {
          id: string;
          name: string;
          company_name: string | null;
          phone: string | null;
          email: string | null;
          city: string | null;
          intervention_zone: string | null;
          specialty: string | null;
          cost_rate: number | null;
          status: ProviderStatus;
          user_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      service_catalog: {
        Row: {
          id: string;
          code: string | null;
          label: string;
          description: string | null;
          unit: string;
          unit_price_ht: number;
          vat_rate: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      interventions: {
        Row: {
          id: string;
          reference: string | null;
          client_id: string;
          installation_id: string | null;
          provider_id: string | null;
          scheduled_date: string | null;
          time_slot: string | null;
          service_type: string | null;
          status: InterventionStatus;
          description: string | null;
          price_ht: number | null;
          notes: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      intervention_photos: {
        Row: {
          id: string;
          intervention_id: string;
          client_id: string;
          kind: PhotoKind;
          storage_path: string;
          comment: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          reference: string | null;
          client_id: string;
          lead_id: string | null;
          installation_id: string | null;
          status: QuoteStatus;
          issued_at: string | null;
          valid_until: string | null;
          notes: string | null;
          discount_ht: number;
          deposit_amount: number;
          payment_terms: string | null;
          converted_intervention_id: string | null;
          subtotal_ht: number;
          vat_amount: number;
          total_ttc: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          service_catalog_id: string | null;
          label: string;
          description: string | null;
          quantity: number;
          unit_price_ht: number;
          vat_rate: number;
          position: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          number: string | null;
          client_id: string;
          quote_id: string | null;
          issued_at: string;
          due_at: string | null;
          status: InvoiceStatus;
          notes: string | null;
          discount_ht: number;
          subtotal_ht: number;
          vat_amount: number;
          total_ttc: number;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          label: string;
          description: string | null;
          quantity: number;
          unit_price_ht: number;
          vat_rate: number;
          position: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          client_id: string;
          amount: number;
          paid_at: string;
          method: PaymentMethod;
          reference: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          client_id: string;
          doc_type: DocumentType;
          title: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          client_id: string | null;
          lead_id: string | null;
          activity_type: ActivityType;
          title: string;
          description: string | null;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      intervention_reports: {
        Row: {
          id: string;
          intervention_id: string;
          work_completed: string | null;
          observations: string | null;
          difficulties: string | null;
          recommendations: string | null;
          checklist: Json;
          provider_signature: string | null;
          client_signature: string | null;
          validated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      credit_notes: {
        Row: {
          id: string;
          number: string;
          invoice_id: string;
          client_id: string;
          issued_at: string;
          reason: string;
          subtotal_ht: number;
          discount_ht: number;
          vat_amount: number;
          total_ttc: number;
          lines: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      invoice_balances: {
        Row: {
          invoice_id: string;
          client_id: string;
          number: string | null;
          total_ttc: number;
          amount_paid: number;
          amount_due: number;
          status: InvoiceStatus;
          due_at: string | null;
          issued_at: string;
        };
        Relationships: [];
      };
      client_financial_summary: {
        Row: {
          client_id: string;
          total_invoiced: number;
          total_paid: number;
          amount_due: number;
          last_intervention_at: string | null;
          next_intervention_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_commercial_or_admin: { Args: Record<string, never>; Returns: boolean };
      current_staff_role: { Args: Record<string, never>; Returns: StaffRole };
      refresh_invoice_payment_status: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      create_quote: {
        Args: {
          p_client_id: string;
          p_items: Json;
          p_lead_id?: string | null;
          p_installation_id?: string | null;
          p_valid_until?: string | null;
          p_notes?: string | null;
          p_discount_ht?: number;
          p_deposit_amount?: number;
          p_payment_terms?: string | null;
        };
        Returns: string;
      };
      create_invoice: {
        Args: {
          p_client_id: string;
          p_items: Json;
          p_due_at?: string | null;
          p_notes?: string | null;
          p_discount_ht?: number;
        };
        Returns: string;
      };
      create_invoice_from_quote: {
        Args: { p_quote_id: string; p_due_at?: string | null };
        Returns: string;
      };
      cancel_invoice: {
        Args: { p_invoice_id: string; p_reason: string };
        Returns: string;
      };
      list_staff_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          display_name: string | null;
          role: StaffRole;
          last_sign_in_at: string | null;
          provider_id: string | null;
          provider_name: string | null;
        }[];
      };
      list_access_requests: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          display_name: string | null;
          requested_role: string | null;
          created_at: string;
        }[];
      };
      grant_staff_access: {
        Args: {
          p_user_id: string;
          p_role: StaffRole;
          p_display_name?: string | null;
          p_provider_id?: string | null;
        };
        Returns: undefined;
      };
      revoke_staff_access: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      convert_lead_to_client: {
        Args: { p_lead_id: string; p_mark_won?: boolean };
        Returns: { client_id: string; installation_id: string; created: boolean };
      };
      create_intervention_from_quote: {
        Args: { p_quote_id: string };
        Returns: string;
      };
      save_intervention_report: {
        Args: {
          p_intervention_id: string;
          p_work_completed: string | null;
          p_observations?: string | null;
          p_difficulties?: string | null;
          p_recommendations?: string | null;
          p_provider_signature?: string | null;
          p_client_signature?: string | null;
          p_validate?: boolean;
        };
        Returns: string;
      };
    };
    Enums: {
      staff_role: StaffRole;
      lead_status: LeadStatus;
      client_status: ClientStatus;
      intervention_status: InterventionStatus;
      photo_kind: PhotoKind;
      quote_status: QuoteStatus;
      invoice_status: InvoiceStatus;
      payment_method: PaymentMethod;
      provider_status: ProviderStatus;
      document_type: DocumentType;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
