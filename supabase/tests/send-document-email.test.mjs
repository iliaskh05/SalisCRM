// Test de l'Edge Function send-document-email sous Node : faux Deno, faux client Supabase,
// faux Resend. Vérifie les refus (auth, rôle, destinataire, pièce jointe) et le cas nominal.
// Lancer : npm run test:functions
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

let handler;
const env = {
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Salis <devis@salis.test>",
  EMAIL_REPLY_TO: "contact@salis.test",
};
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => (handler = h) };

// Faux état de la « base » piloté par chaque test
const db = { isStaff: true, clientEmails: ["chef@bistro.fr"], lastClientFilter: null };
const fakeSupabase = `
export const createClient = () => ({
  rpc: async () => ({ data: globalThis.__db.isStaff, error: null }),
  from: () => ({
    select: () => ({
      ilike: (_col, pattern) => ({
        limit: async () => {
          globalThis.__db.lastClientFilter = pattern;
          const hit = globalThis.__db.clientEmails.some((e) => e === pattern);
          return { data: hit ? [{ id: "c1" }] : [], error: null };
        },
      }),
    }),
  }),
});`;
globalThis.__db = db;

const source = readFileSync(new URL("../functions/send-document-email/index.ts", import.meta.url), "utf8")
  .replace("npm:@supabase/supabase-js@2", "data:text/javascript," + encodeURIComponent(fakeSupabase))
  .replace(/\(b64: string\)/g, "(b64)")
  .replace(/: (string|number|Response|Record<string, unknown>|unknown)\b(?=[,)=\s{])/g, "")
  .replace(/let body: \{[^}]*\};/, "let body;");
await import("data:text/javascript," + encodeURIComponent(source));

const PDF = Buffer.from("%PDF-1.4 fake").toString("base64");
const valid = () => ({ to: "chef@bistro.fr", subject: "Devis D-2026-0001", text: "Bonjour", filename: "Devis-D-2026-0001.pdf", pdf_base64: PDF });
const call = (body, headers = { Authorization: "Bearer jwt" }, method = "POST") =>
  handler(new Request("https://f/send", { method, headers: { "Content-Type": "application/json", ...headers }, body: method === "POST" ? JSON.stringify(body) : undefined }));

let resendCalls = [];
globalThis.fetch = async (url, init) => {
  resendCalls.push({ url, init });
  return globalThis.__resendResult ?? new Response(JSON.stringify({ id: "em_123" }), { status: 200 });
};
test.beforeEach(() => {
  resendCalls = [];
  db.isStaff = true;
  db.clientEmails = ["chef@bistro.fr"];
  globalThis.__resendResult = null;
  env.RESEND_API_KEY = "re_test";
});

test("cas nominal : envoi Resend avec pièce jointe, from et reply_to", async () => {
  const res = await call(valid());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: "em_123" });
  assert.equal(resendCalls.length, 1);
  assert.equal(resendCalls[0].url, "https://api.resend.com/emails");
  assert.equal(resendCalls[0].init.headers.Authorization, "Bearer re_test");
  const sent = JSON.parse(resendCalls[0].init.body);
  assert.deepEqual(sent.to, ["chef@bistro.fr"]);
  assert.equal(sent.from, "Salis <devis@salis.test>");
  assert.equal(sent.reply_to, "contact@salis.test");
  assert.deepEqual(sent.attachments, [{ filename: "Devis-D-2026-0001.pdf", content: PDF }]);
});

test("pas d'en-tête Authorization → 401, rien d'envoyé", async () => {
  assert.equal((await call(valid(), {})).status, 401);
  assert.equal(resendCalls.length, 0);
});

test("utilisateur non commercial / admin → 403", async () => {
  db.isStaff = false;
  assert.equal((await call(valid())).status, 403);
  assert.equal(resendCalls.length, 0);
});

test("destinataire qui n'est pas un client enregistré → 403", async () => {
  const res = await call({ ...valid(), to: "inconnu@ailleurs.fr" });
  assert.equal(res.status, 403);
  assert.equal(resendCalls.length, 0);
});

test("jokers LIKE échappés dans la recherche du destinataire", async () => {
  await call({ ...valid(), to: "a_b%c@x.fr" });
  assert.equal(db.lastClientFilter, "a\\_b\\%c@x.fr");
});

test("validations : e-mail, objet, pièce jointe", async () => {
  for (const patch of [
    { to: "pas-un-mail" },
    { subject: "" },
    { subject: "x".repeat(201) },
    { text: "" },
    { filename: "malware.exe" },
    { pdf_base64: "pas du base64 !!" },
    { pdf_base64: "A".repeat(8 * 1024 * 1024) },
  ]) {
    const res = await call({ ...valid(), ...patch });
    assert.equal(res.status, 400, JSON.stringify(Object.keys(patch)));
  }
  assert.equal(resendCalls.length, 0);
});

test("nom de fichier nettoyé (pas de chemin)", async () => {
  await call({ ...valid(), filename: "../../etc/passwd.pdf" });
  const sent = JSON.parse(resendCalls[0].init.body);
  assert.doesNotMatch(sent.attachments[0].filename, /[\\/]/);
  assert.match(sent.attachments[0].filename, /\.pdf$/);
});

test("clé Resend absente → 501 explicite", async () => {
  env.RESEND_API_KEY = undefined;
  const res = await call(valid());
  assert.equal(res.status, 501);
  assert.match((await res.json()).error, /pas configuré/);
});

test("Resend refuse → 502, détail non divulgué", async () => {
  globalThis.__resendResult = new Response(JSON.stringify({ message: "domain not verified: secret detail" }), { status: 403 });
  const res = await call(valid());
  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(await res.json()), /secret detail/);
});

test("méthode GET refusée ; OPTIONS (CORS) accepté", async () => {
  assert.equal((await call(null, {}, "GET")).status, 405);
  assert.equal((await call(null, {}, "OPTIONS")).status, 200);
});
