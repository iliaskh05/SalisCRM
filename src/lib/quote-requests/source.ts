const WEBSITE_SOURCE_KEYS = [
  "website_form",
  "website",
  "site web",
  "site",
  "formulaire",
  "pro-extract-hub",
  "lovable",
];

export const PUBLIC_SITE_LABEL = "Site commercial Salis 3 Hottes";
export const PUBLIC_SITE_URL = "https://pro-extract-hub.lovable.app";

export function isWebsiteQuoteRequest(lead: {
  source?: string | null;
  landing_page?: string | null;
  channel?: "website" | "internal";
}): boolean {
  if (lead.channel === "website") return true;
  if (lead.channel === "internal") return false;
  if (lead.landing_page) return true;
  const src = (lead.source ?? "").trim().toLowerCase();
  if (!src) return false;
  return WEBSITE_SOURCE_KEYS.some((key) => src === key || src.includes(key));
}

export function sourceLabel(source: string | null | undefined, landingPage?: string | null): string {
  if (isWebsiteQuoteRequest({ source, landing_page: landingPage })) {
    return PUBLIC_SITE_LABEL;
  }
  return source?.trim() || "Origine interne";
}
