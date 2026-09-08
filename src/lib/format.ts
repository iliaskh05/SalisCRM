import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";

export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value: string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!value) return "—";
  const d = value.length <= 10 ? parseISO(value) : new Date(value);
  if (!isValid(d)) return "—";
  return format(d, pattern, { locale: fr });
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function startOfMonthISO(): string {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
}

export function endOfMonthISO(): string {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd");
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}
