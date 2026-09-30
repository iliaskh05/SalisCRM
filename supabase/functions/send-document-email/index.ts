// Envoi d'un document (devis, facture…) par e-mail avec son PDF en pièce jointe, via Resend.
// Sécurité :
//  - appelant authentifié ET commercial / admin (vérifié en base avec SON jeton)
//  - destinataire = adresse d'un client enregistré (un compte compromis ne peut pas
//    servir à envoyer des e-mails à n'importe qui depuis le domaine de l'entreprise)
//  - taille de pièce jointe et longueur des champs bornées
// Déploiement : supabase functions deploy send-document-email
// Secrets : supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Salis 3 Hottes <devis@votre-domaine.fr>" EMAIL_REPLY_TO=contact@votre-domaine.fr
// (le domaine d'envoi doit être vérifié dans Resend : SPF / DKIM)
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

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

function approxBase64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!url || !anonKey) return json({ error: "Fonction mal configurée." }, 500);
  if (!resendKey || !from) return json({ error: "L’envoi d’e-mails n’est pas configuré sur ce serveur." }, 501);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Non authentifié." }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: allowed, error: roleErr } = await caller.rpc("is_commercial_or_admin");
  if (roleErr || allowed !== true) return json({ error: "Accès refusé." }, 403);

  let body: { to?: unknown; subject?: unknown; text?: unknown; filename?: unknown; pdf_base64?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  const filename = typeof body.filename === "string" ? body.filename.replace(/[^A-Za-z0-9._-]+/g, "-") : "";
  const pdf = typeof body.pdf_base64 === "string" ? body.pdf_base64 : "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Adresse e-mail du destinataire invalide." }, 400);
  if (!subject || subject.length > 200) return json({ error: "Objet invalide." }, 400);
  if (!text || text.length > 10_000) return json({ error: "Message invalide." }, 400);
  if (!filename.toLowerCase().endsWith(".pdf") || filename.length > 100) return json({ error: "Nom de pièce jointe invalide." }, 400);
  if (!/^[A-Za-z0-9+/=]+$/.test(pdf) || approxBase64Bytes(pdf) > MAX_PDF_BYTES) {
    return json({ error: "Pièce jointe invalide ou trop volumineuse (5 Mo maximum)." }, 400);
  }

  // Destinataire = client enregistré (RLS appliquée avec le jeton de l'appelant)
  const { data: known, error: clientErr } = await caller
    .from("clients")
    .select("id")
    .ilike("email", to.replace(/[\\%_]/g, "\\$&"))
    .limit(1);
  if (clientErr) return json({ error: "Vérification du destinataire impossible." }, 500);
  if (!known || known.length === 0) {
    return json({ error: "Ce destinataire n’est pas l’adresse d’un client enregistré." }, 403);
  }

  const replyTo = Deno.env.get("EMAIL_REPLY_TO");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      attachments: [{ filename, content: pdf }],
    }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("resend error", res.status, JSON.stringify(result));
    return json({ error: "Le fournisseur d’e-mails a refusé l’envoi." }, 502);
  }
  return json({ id: result.id ?? null });
});
