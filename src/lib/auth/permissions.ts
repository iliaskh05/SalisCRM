import type { StaffRole } from "@/lib/supabase/types";

export const STAFF_ROLES = ["admin", "commercial", "prestataire"] as const;

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Direction / Admin",
  commercial: "Commercial",
  prestataire: "Prestataire",
};

/** Permissions applicatives (UX + garde-routes). La vraie sécurité reste en RLS. */
export type Permission =
  | "dashboard:view"
  | "leads:read"
  | "leads:write"
  | "leads:delete"
  | "clients:read"
  | "clients:write"
  | "clients:delete"
  | "installations:read"
  | "installations:write"
  | "interventions:read"
  | "interventions:write"
  | "interventions:create"
  | "photos:read"
  | "photos:write"
  | "quotes:read"
  | "quotes:write"
  | "invoices:read"
  | "invoices:write"
  | "payments:read"
  | "payments:write"
  | "providers:read"
  | "providers:write"
  | "documents:read"
  | "documents:write"
  | "activities:read"
  | "users:manage"
  | "finances:view"
  | "stats:view";

const ADMIN_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "leads:read",
  "leads:write",
  "leads:delete",
  "clients:read",
  "clients:write",
  "clients:delete",
  "installations:read",
  "installations:write",
  "interventions:read",
  "interventions:write",
  "interventions:create",
  "photos:read",
  "photos:write",
  "quotes:read",
  "quotes:write",
  "invoices:read",
  "invoices:write",
  "payments:read",
  "payments:write",
  "providers:read",
  "providers:write",
  "documents:read",
  "documents:write",
  "activities:read",
  "users:manage",
  "finances:view",
  "stats:view",
];

const COMMERCIAL_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "leads:read",
  "leads:write",
  "clients:read",
  "clients:write",
  "installations:read",
  "installations:write",
  "interventions:read",
  "interventions:write",
  "interventions:create",
  "photos:read",
  "photos:write",
  "quotes:read",
  "quotes:write",
  "invoices:read",
  "invoices:write",
  "payments:read",
  "payments:write",
  "providers:read",
  "documents:read",
  "documents:write",
  "activities:read",
  "finances:view",
  "stats:view",
];

/** Accès limité terrain — pas de finance consolidée. */
const PRESTATAIRE_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "interventions:read",
  "interventions:write",
  "photos:read",
  "photos:write",
  "clients:read",
  "installations:read",
];

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  admin: ADMIN_PERMISSIONS,
  commercial: COMMERCIAL_PERMISSIONS,
  prestataire: PRESTATAIRE_PERMISSIONS,
};

export function permissionsFor(role: StaffRole | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function canAny(
  role: StaffRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => can(role, p));
}

export function isAdmin(role: StaffRole | null | undefined): boolean {
  return role === "admin";
}

export function isCommercialOrAdmin(role: StaffRole | null | undefined): boolean {
  return role === "admin" || role === "commercial";
}
