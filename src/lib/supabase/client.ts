import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseConfigStatus(): {
  configured: boolean;
  url: string;
  missing: string[];
  reason?: string;
} {
  const url = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const missing: string[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  if (!key) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (key.includes("service_role") || key.startsWith("sb_secret_")) {
    return {
      configured: false,
      url,
      missing,
      reason:
        "Clé refusée : ne jamais mettre SUPABASE_SERVICE_ROLE_KEY / sb_secret_ dans le frontend.",
    };
  }

  return { configured: missing.length === 0, url, missing };
}

function createSupabaseClient(): SupabaseClient<Database> {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    const detail =
      status.reason ??
      `Variables manquantes: ${status.missing.join(", ")}. Renseignez .env (clé publishable uniquement).`;
    throw new Error(detail);
  }

  const url = readEnv("VITE_SUPABASE_URL");
  const key = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? localStorage : undefined,
    },
  });
}

let client: SupabaseClient<Database> | undefined;

export function getSupabase() {
  if (!client) client = createSupabaseClient();
  return client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
