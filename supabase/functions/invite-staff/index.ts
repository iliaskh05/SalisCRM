// Invitation d'un membre du staff (direction uniquement).
// - Vérifie que l'appelant est admin (avec SON jeton : is_admin() côté base)
// - Compte existant → accès accordé directement ; sinon e-mail d'invitation Supabase
// - Rôle + fiche prestataire appliqués par grant_staff_access() (même contrôles que l'UI)
// Déploiement : supabase functions deploy invite-staff
// Secrets requis (fournis par Supabase) : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLES = ["admin", "commercial", "prestataire"] as const;
type Role = (typeof ROLES)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Fonction mal configurée." }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Non authentifié." }, 401);

  // Client « appelant » : toutes les vérifications de droits passent par la base
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: adminErr } = await caller.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "Réservé à la direction." }, 403);

  let body: {
    email?: unknown;
    display_name?: unknown;
    role?: unknown;
    provider_id?: unknown;
    redirect_to?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const role = body.role as Role;
  const providerId = typeof body.provider_id === "string" && body.provider_id ? body.provider_id : null;
  const redirectTo = typeof body.redirect_to === "string" ? body.redirect_to : undefined;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse e-mail invalide." }, 400);
  if (!ROLES.includes(role)) return json({ error: "Rôle invalide." }, 400);
  if (role === "prestataire" && !providerId) {
    return json({ error: "Choisissez la fiche prestataire à associer." }, 400);
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existingId, error: findErr } = await service.rpc("admin_find_user_by_email", { p_email: email });
  if (findErr) return json({ error: findErr.message }, 500);

  let userId = existingId as string | null;
  let invited = false;
  if (!userId) {
    // redirectTo doit figurer dans Auth > URL Configuration > Redirect URLs
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { display_name: displayName || undefined },
    });
    if (error || !data.user) return json({ error: error?.message ?? "Invitation impossible." }, 400);
    userId = data.user.id;
    invited = true;
  }

  const { error: grantErr } = await caller.rpc("grant_staff_access", {
    p_user_id: userId,
    p_role: role,
    p_display_name: displayName || null,
    p_provider_id: role === "prestataire" ? providerId : null,
  });
  if (grantErr) return json({ error: grantErr.message, user_id: userId, invited }, 400);

  return json({ user_id: userId, invited });
});
