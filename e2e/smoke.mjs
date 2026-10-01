// Test navigateur (Chromium) : vraies pages du build, faux serveur Supabase (aucun compte requis).
// Lancer : npm run test:e2e   (première fois : npx playwright install chromium)
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SP = join(tmpdir(), "saliscrm-e2e");
const DIST = join(SP, "dist");
const BASE = "http://localhost:4173";
const SB = "https://testproj.supabase.co";
mkdirSync(`${SP}/shots`, { recursive: true });

const USER = { id: "00000000-0000-0000-0000-00000000000a", aud: "authenticated", role: "authenticated", email: "direction@test.fr", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (aal) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, aal, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 36000, session_id: "s1" })}.sig`;
const FACTOR = { id: "f1", friendly_name: "Téléphone", factor_type: "totp", status: "verified", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
const mfaSession = (aal, factors = [FACTOR]) => ({ access_token: jwt(aal), refresh_token: "r", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { ...USER, factors } });
const session = (email = USER.email) => ({ access_token: "a.b.c", refresh_token: "r", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { ...USER, email } });

// ---- faux backend ----
const N_CLIENTS = 1234;
const clients = Array.from({ length: N_CLIENTS }, (_, i) => ({
  id: `c-${String(i).padStart(5, "0")}`, reference: `CLI-2026-${String(i + 1).padStart(4, "0")}`, company_name: `Société ${i + 1}`, contact_name: "Contact", city: "Lyon", email: `c${i}@x.fr`,
  status: "active", business_type: "restaurant", created_at: new Date(Date.UTC(2026, 0, 1) + (N_CLIENTS - i) * 3600e3).toISOString(),
}));
const summaries = clients.map((c) => ({ client_id: c.id, total_invoiced: 100, total_paid: 40, amount_due: 60, last_intervention_at: null, next_intervention_at: null }));
const items = [
  { id: "i1", invoice_id: "inv1", quote_id: "q1", label: "Dégraissage hotte", description: "Démontage et remontage", quantity: 1, unit_price_ht: 480, vat_rate: 20, position: 0 },
  { id: "i2", invoice_id: "inv1", quote_id: "q1", label: "Filtres inox", description: null, quantity: 6, unit_price_ht: 24.9, vat_rate: 20, position: 1 },
];
const tables = {
  staff_profiles: (ctx) => [{ user_id: USER.id, role: ctx.role, display_name: "Test", created_at: "" }],
  clients, client_financial_summary: summaries,
  quotes: [{ id: "q1", reference: "D-2026-0001", client_id: "c-00000", status: "sent", issued_at: "2026-09-30", valid_until: "2026-10-30", subtotal_ht: 629.4, discount_ht: 0, vat_amount: 125.88, total_ttc: 755.28, deposit_amount: 0, notes: null, payment_terms: null, lead_id: null, created_at: "2026-09-30T10:00:00Z" }],
  quote_items: items,
  invoices: [{ id: "inv1", number: "F-2026-0001", client_id: "c-00000", quote_id: "q1", issued_at: "2026-09-30", due_at: "2026-10-30", status: "unpaid", subtotal_ht: 629.4, discount_ht: 0, vat_amount: 125.88, total_ttc: 755.28, notes: null, created_at: "2026-09-30T10:00:00Z" }],
  invoice_items: items,
  invoice_balances: [{ invoice_id: "inv1", client_id: "c-00000", number: "F-2026-0001", total_ttc: 755.28, amount_paid: 0, amount_due: 755.28, status: "unpaid", due_at: "2026-10-30", issued_at: "2026-09-30" }],
  payments: [], credit_notes: [], interventions: [], provider_interventions: [], providers: [], leads: [], activities: [], documents: [],
};

const requestLog = [];
const authCalls = [];
const rpcLog = [];
const tableLog = [];
async function mockBackend(context, { role }) {
  await context.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (path.startsWith("/auth/v1/")) {
      const j = (o) => route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(o) });
      const factors = context.__factors ?? [];
      if (path.endsWith("/challenge")) return j({ id: "ch1", type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (path.endsWith("/verify")) { authCalls.push({ path, body: req.postData() }); return j({ access_token: jwt("aal2"), token_type: "bearer", expires_in: 36000, refresh_token: "r2", user: { ...USER, factors } }); }
      if (path === "/auth/v1/factors" && req.method() === "POST") return j({ id: "f-new", type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x" } });
      return j({ user: { ...USER, factors } });
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      const fn = path.split("/").pop();
      rpcLog.push(fn);
      const body = fn === "security_policy" ? { require_admin_mfa: context.__requireMfa === true } : null;
      return route.fulfill({ status: body ? 200 : 204, headers: { ...cors, "content-type": "application/json" }, body: body ? JSON.stringify(body) : "" });
    }
    const m = path.match(/^\/rest\/v1\/(\w+)/);
    if (!m) return route.fulfill({ status: 404, headers: cors, body: "{}" });
    const name = m[1];
    let rows = typeof tables[name] === "function" ? tables[name]({ role }) : tables[name] ?? [];
    for (const [k, v] of url.searchParams) {
      if (v.startsWith("eq.")) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    // comme PostgREST : 1000 lignes maximum par requête
    const page = rows.slice(offset, offset + Math.min(limit, 1000));
    requestLog.push({ name, offset, limit, returned: page.length });
    tableLog.push(name);
    const accept = req.headers()["accept"] ?? "";
    const single = accept.includes("vnd.pgrst.object");
    const headers = { ...cors, "content-type": "application/json", "content-range": `${offset}-${offset + page.length - 1}/${rows.length}` };
    if (single) {
      return page.length ? route.fulfill({ status: 200, headers, body: JSON.stringify(page[0]) }) : route.fulfill({ status: 406, headers, body: JSON.stringify({ code: "PGRST116", message: "no rows", details: "", hint: "" }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(page) });
  });
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(cond ? "  ✔" : "  ✘", name, cond ? "" : extra); };

const build = spawnSync("npx", ["vite", "build", "--outDir", DIST, "--emptyOutDir"], {
  cwd: ROOT,
  shell: true,
  stdio: "inherit",
  env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", VITE_APP_ENV: "staging", VITE_DEMO_MODE: "" },
});
if (build.status !== 0) process.exit(1);
const server = spawn("npx", ["vite", "preview", "--outDir", DIST, "--port", "4173", "--strictPort"], { cwd: ROOT, shell: true, stdio: "ignore" });
let serverExited = false;
server.on("exit", () => (serverExited = true));
await new Promise((r) => setTimeout(r, 4000));
if (serverExited) {
  console.error("Le serveur de prévisualisation n’a pas démarré : le port 4173 est probablement déjà occupé (ancien test resté actif).");
  process.exit(1);
}

const browser = await chromium.launch();
async function newPage({ role = "admin", signedIn = true, viewport = { width: 1280, height: 900 }, stored = null, factors = [], requireMfa = false } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  context.__factors = factors;
  context.__requireMfa = requireMfa;
  if (signedIn) await context.addInitScript((s) => localStorage.setItem("sb-testproj-auth-token", JSON.stringify(s)), stored ?? session());
  await mockBackend(context, { role });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|WebSocket connection|realtime/.test(m.text())) errors.push(m.text()); });
  return { page, errors, context };
}

try {
  console.log("\n# Non connecté");
  {
    const { page, errors } = await newPage({ signedIn: false });
    await page.goto(`${BASE}/clients`);
    await page.waitForURL("**/login");
    ok("route protégée → /login", true);
    ok("page de connexion affichée", await page.getByText("Se connecter").first().isVisible());
    ok("plus de lien « Demander un accès »", (await page.getByText("Demander un accès").count()) === 0);
    await page.goto(`${BASE}/register`);
    await page.waitForURL("**/login");
    ok("/register → /login", true);
    await page.goto(`${BASE}/definir-mot-de-passe`);
    await page.getByText(/invalide ou a expiré/).waitFor({ timeout: 15000 }).catch(() => {});
    ok("lien d'invitation invalide → message clair", await page.getByText(/invalide ou a expiré/).isVisible());
    await page.goto(`${BASE}/n-importe-quoi`);
    await page.getByText("Page introuvable").waitFor({ timeout: 15000 }).catch(() => {});
    ok("URL inconnue → page 404", await page.getByText("Page introuvable").isVisible());
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Direction : liste de 1 234 clients");
  {
    const { page, errors } = await newPage({ role: "admin" });
    requestLog.length = 0;
    await page.goto(`${BASE}/clients`);
    await page.getByText("Société 1234", { exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.getByText(/sur 1234/).waitFor({ timeout: 15000 });
    ok("les 1 234 clients sont chargés (pas 1 000)", true);
    const clientReqs = requestLog.filter((r) => r.name === "clients");
    ok("lecture par tranches de 1000", clientReqs.length === 2 && clientReqs[0].returned === 1000 && clientReqs[1].returned === 234, JSON.stringify(clientReqs));
    ok("50 lignes affichées", (await page.locator("tbody tr").count()) === 50);
    ok("pagination « 1–50 sur 1234 »", await page.getByText("1–50 sur 1234").isVisible());
    await page.getByRole("button", { name: "Suivant" }).click();
    ok("page suivante : 51–100", await page.getByText("51–100 sur 1234").isVisible());
    await page.getByPlaceholder(/echerch/i).first().fill("Société 1234");
    ok("recherche → retour page 1, 1 résultat", (await page.locator("tbody tr").count()) === 1);
    ok("pagination masquée pour 1 page", (await page.getByRole("navigation", { name: "Pagination" }).count()) === 0);
    await page.screenshot({ path: `${SP}/shots/clients.png` });
    ok("menu latéral présent (Suspense dans le cadre)", await page.getByRole("link", { name: "Factures" }).first().isVisible());
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Direction : facture et PDF");
  {
    const { page, errors } = await newPage({ role: "admin" });
    await page.goto(`${BASE}/factures/inv1`);
    await page.getByText("F-2026-0001").first().waitFor({ timeout: 15000 });
    ok("fiche facture affichée", true);
    ok("bouton « Annuler par avoir » (direction)", await page.getByRole("button", { name: /Annuler par avoir/ }).isVisible());
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.getByRole("button", { name: "Facture Factur-X" }).click()]);
    const path = `${SP}/shots/${download.suggestedFilename()}`;
    await download.saveAs(path);
    ok("PDF téléchargé sous le bon nom", download.suggestedFilename() === "Facture-F-2026-0001.pdf", download.suggestedFilename());
    ok("PDF non vide", statSync(path).size > 5000);
    const bytes = readFileSync(path).toString("latin1");
    ok("c’est un PDF/A-3 portant le XML Factur-X", bytes.startsWith("%PDF-") && bytes.includes("pdfaid:part>3<") && bytes.includes("factur-x.xml") && bytes.includes("/AFRelationship /Data"));
    ok("polices intégrées (exigence PDF/A)", bytes.includes("/FontFile2") && !bytes.includes("/BaseFont /Helvetica"));
    await page.screenshot({ path: `${SP}/shots/facture.png` });
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Direction : devis");
  {
    const { page, errors } = await newPage({ role: "admin" });
    await page.goto(`${BASE}/devis/q1`);
    await page.getByText("D-2026-0001").first().waitFor({ timeout: 15000 });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.getByRole("button", { name: "PDF", exact: true }).click()]);
    ok("PDF du devis téléchargé", download.suggestedFilename() === "Devis-D-2026-0001.pdf", download.suggestedFilename());
    await page.getByRole("button", { name: /Envoyer le devis/ }).click();
    ok("envoi non configuré : libellé honnête", await page.getByText("Envoi e-mail non configuré", { exact: true }).isVisible());
    ok("bouton « Marquer comme envoyé manuellement »", await page.getByRole("button", { name: /Marquer comme envoyé manuellement/ }).isVisible());
    await page.screenshot({ path: `${SP}/shots/devis-envoi.png` });
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Prestataire");
  {
    const { page, errors } = await newPage({ role: "prestataire" });
    await page.goto(`${BASE}/`);
    await page.waitForURL("**/interventions", { timeout: 15000 });
    ok("arrive directement sur ses interventions", true);
    ok("pas de menu Factures", (await page.getByRole("link", { name: "Factures" }).count()) === 0);
    ok("pas de menu Paramètres", (await page.getByRole("link", { name: "Paramètres" }).count()) === 0);
    await page.goto(`${BASE}/factures`);
    await page.waitForURL("**/unauthorized", { timeout: 15000 });
    ok("/factures → accès refusé", true);
    await page.goto(`${BASE}/settings`);
    await page.waitForURL("**/unauthorized", { timeout: 15000 });
    ok("/settings → accès refusé", true);
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Prestataire : création d'intervention");
  {
    const { page } = await newPage({ role: "prestataire" });
    await page.goto(`${BASE}/interventions`);
    await page.getByText("Aucune intervention").waitFor({ timeout: 15000 });
    ok("pas de bouton « Nouvelle intervention »", (await page.getByRole("button", { name: /Nouvelle intervention/ }).count()) === 0);
    await page.goto(`${BASE}/interventions/nouvelle`);
    await page.waitForURL("**/unauthorized", { timeout: 15000 });
    ok("/interventions/nouvelle → accès refusé", true);
    await page.context().close();
  }
  {
    const { page } = await newPage({ role: "admin" });
    await page.goto(`${BASE}/interventions`);
    await page.getByText("Aucune intervention").waitFor({ timeout: 15000 });
    ok("la direction garde le bouton « Nouvelle intervention »", (await page.getByRole("button", { name: /Nouvelle intervention/ }).count()) === 1);
    await page.context().close();
  }

  console.log("\n# Double authentification : connexion avec code");
  {
    const { page, errors } = await newPage({ role: "admin", stored: mfaSession("aal1"), factors: [FACTOR] });
    authCalls.length = 0;
    await page.goto(`${BASE}/clients`);
    await page.waitForURL("**/login", { timeout: 15000 });
    await page.getByLabel("Code de vérification").waitFor({ timeout: 15000 });
    ok("session aal1 + MFA activée → écran de code (pas d'accès aux données)", true);
    ok("pas de formulaire mot de passe à cette étape", (await page.getByLabel("Mot de passe").count()) === 0);
    await page.getByLabel("Code de vérification").fill("12ab34");
    ok("saisie limitée aux chiffres", (await page.getByLabel("Code de vérification").inputValue()) === "1234");
    await page.getByRole("button", { name: "Valider" }).click();
    ok("code incomplet refusé côté écran", (await page.getByText(/6 chiffres/).count()) >= 1 && authCalls.length === 0);
    await page.screenshot({ path: `${SP}/shots/mfa-login.png` });
    await page.getByLabel("Code de vérification").fill("123456");
    await page.getByRole("button", { name: "Valider" }).click();
    await page.waitForURL(/\/clients$|\/$/, { timeout: 15000 });
    ok("code valide → accès à l'application", true);
    ok("le code est bien envoyé au serveur", authCalls.some((c) => c.path.endsWith("/verify") && /123456/.test(c.body ?? "")));
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Sécurité du compte : activation");
  {
    const { page, errors } = await newPage({ role: "commercial" });
    await page.goto(`${BASE}/securite`);
    await page.getByRole("button", { name: "Activer la double authentification" }).click();
    await page.getByAltText(/QR code/).waitFor({ timeout: 15000 });
    ok("QR code affiché", true);
    ok("clé manuelle affichée", await page.getByText("JBSWY3DPEHPK3PXP").isVisible());
    ok("« Activer » désactivé tant que le code n'est pas complet", await page.getByRole("button", { name: "Activer", exact: true }).isDisabled());
    await page.screenshot({ path: `${SP}/shots/mfa-enroll.png` });
    ok("accessible à un commercial (pas réservé à la direction)", true);
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }
  {
    const { page } = await newPage({ role: "admin", stored: mfaSession("aal2"), factors: [FACTOR] });
    await page.goto(`${BASE}/securite`);
    await page.getByText("Téléphone", { exact: true }).waitFor({ timeout: 15000 });
    ok("appareil enregistré listé avec « Désactiver »", await page.getByRole("button", { name: "Désactiver" }).isVisible());
    await page.context().close();
  }

  console.log("\n# Direction : paramètres (accès et conservation)");
  {
    const { page, errors } = await newPage({ role: "admin", stored: mfaSession("aal2", []) });
    await page.goto(`${BASE}/settings`);
    await page.getByText("Conservation des données").waitFor({ timeout: 15000 });
    ok("carte « Conservation des données » affichée", true);
    ok("bouton « Simuler » présent (jamais de suppression directe)", await page.getByRole("button", { name: "Simuler" }).isVisible());
    ok("aucune suppression proposée avant simulation", (await page.getByRole("button", { name: /Supprimer définitivement/ }).count()) === 0);
    await page.screenshot({ path: `${SP}/shots/settings.png`, fullPage: true });
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }

  console.log("\n# Prestataire : aucune donnée financière demandée");
  {
    const { page } = await newPage({ role: "prestataire" });
    tableLog.length = 0;
    await page.goto(`${BASE}/interventions`);
    await page.getByText("Aucune intervention").waitFor({ timeout: 15000 });
    ok("liste lue via la vue provider_interventions", tableLog.includes("provider_interventions"));
    ok("la table interventions (prix HT) n'est jamais interrogée", !tableLog.includes("interventions"), tableLog.join(","));
    await page.context().close();
  }

  console.log("\n# Double authentification obligatoire pour la direction");
  {
    const { page, errors } = await newPage({ role: "admin", requireMfa: true, factors: [] });
    await page.goto(`${BASE}/clients`);
    await page.waitForURL("**/securite", { timeout: 15000 });
    ok("administrateur sans MFA → redirigé vers l'activation", true);
    await page.getByText(/La direction exige la double authentification/).waitFor({ timeout: 15000 }).catch(() => {});
    ok("bandeau explicatif affiché", await page.getByText(/La direction exige la double authentification/).isVisible());
    await page.goto(`${BASE}/factures`);
    await page.waitForURL("**/securite", { timeout: 15000 });
    ok("aucune autre page n'est accessible", true);
    ok("aucune erreur JS", errors.length === 0, errors.join(" | "));
    await page.context().close();
  }
  {
    const { page } = await newPage({ role: "commercial", requireMfa: true, factors: [] });
    await page.goto(`${BASE}/clients`);
    await page.getByText(/sur 1234/).waitFor({ timeout: 15000 });
    ok("un commercial n'est pas concerné par l'obligation", true);
    await page.context().close();
  }
  {
    const { page } = await newPage({ role: "admin", requireMfa: true, stored: mfaSession("aal2"), factors: [FACTOR] });
    await page.goto(`${BASE}/clients`);
    await page.getByText(/sur 1234/).waitFor({ timeout: 15000 });
    ok("administrateur avec MFA (aal2) : accès normal", true);
    await page.context().close();
  }

  console.log("\n# Mobile (prestataire sur le terrain)");
  {
    const { page } = await newPage({ role: "prestataire", viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/interventions`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("pas de défilement horizontal de la page", overflow <= 1, `débordement ${overflow}px`);
    await page.screenshot({ path: `${SP}/shots/mobile-interventions.png` });
    await page.context().close();
  }
} finally {
  await browser.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}
console.log(`\n${pass} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
