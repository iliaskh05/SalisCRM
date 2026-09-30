import type { Database as GeneratedDatabase, Json } from "./database.generated";

export type { Json };

type Generated = GeneratedDatabase["public"];

// Enums tirés du schéma (database.generated.ts, généré depuis les migrations)
export type StaffRole = Generated["Enums"]["staff_role"];
export type LeadStatus = Generated["Enums"]["lead_status"];
export type ClientStatus = Generated["Enums"]["client_status"];
export type InterventionStatus = Generated["Enums"]["intervention_status"];
export type PhotoKind = Generated["Enums"]["photo_kind"];
export type QuoteStatus = Generated["Enums"]["quote_status"];
export type InvoiceStatus = Generated["Enums"]["invoice_status"];
export type PaymentMethod = Generated["Enums"]["payment_method"];
export type ProviderStatus = Generated["Enums"]["provider_status"];
export type DocumentType = Generated["Enums"]["document_type"];
export type ActivityType = Generated["Enums"]["activity_type"];

/**
 * Tables, vues et enums : générés (npm run types:gen).
 * Fonctions RPC : écrites à la main ci-dessous (types de retour précis).
 */
export type Database = {
  public: Omit<Generated, "Functions"> & {
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
          mfa_enabled: boolean;
        }[];
      };
      security_policy: { Args: Record<string, never>; Returns: { require_admin_mfa: boolean } };
      set_require_admin_mfa: { Args: { p_enabled: boolean }; Returns: undefined };
      provider_update_intervention: {
        Args: { p_intervention_id: string; p_status: InterventionStatus; p_notes?: string | null };
        Returns: undefined;
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
      export_client_data: {
        Args: { p_client_id: string };
        Returns: Json;
      };
      anonymize_client: {
        Args: { p_client_id: string; p_reason: string; p_include_company?: boolean };
        Returns: {
          client_id: string;
          leads_anonymized: number;
          documents_to_review: { id: string; title: string; doc_type: string }[];
        };
      };
      purge_expired_leads: {
        Args: { p_months?: number; p_dry_run?: boolean };
        Returns: Json;
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
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
