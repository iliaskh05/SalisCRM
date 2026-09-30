// Tests sécurité : cloisonnement prestataire, gestion des accès, formulaire public, audit.
// Lancer : npm run test:db
import { createTestDb, USERS } from "./_harness.mjs";

const { db, as, ok, rejects, done, asAdmin, asComm, asSuper } = await createTestDb();
const { PRESTA, PRESTA2, RANDO, ADMIN } = USERS;
const asPresta = (s, p) => as("authenticated", PRESTA, s, p);
const asAnon = (s, p) => as("anon", null, s, p);
const rows = async (p) => (await p).rows;

// ---- Jeu de données ----
const [c1, c2] = await rows(asComm(`INSERT INTO clients (company_name) VALUES ('Client A'), ('Client B') RETURNING id`));
const [p1, p2] = await rows(asAdmin(`INSERT INTO providers (name) VALUES ('Presta Un'), ('Presta Deux') RETURNING id`));
const [i1] = await rows(asComm(`INSERT INTO interventions (client_id, provider_id, status, price_ht) VALUES ($1, $2, 'planned', 500) RETURNING id`, [c1.id, p1.id]));
const [i2] = await rows(asComm(`INSERT INTO interventions (client_id, provider_id, status, price_ht) VALUES ($1, $2, 'planned', 800) RETURNING id`, [c2.id, p2.id]));
await asComm(`INSERT INTO client_installations (client_id) VALUES ($1), ($2)`, [c1.id, c2.id]);
await asComm(`SELECT create_invoice($1, '[{"label":"x","quantity":1,"unit_price_ht":100}]'::jsonb)`, [c1.id]);

console.log("\n# Gestion des accès");
await rejects("commercial ne peut pas donner d'accès", () => asComm(`SELECT grant_staff_access($1, 'admin')`, [RANDO]), "direction");
await rejects("prestataire sans fiche refusé", () => asAdmin(`SELECT grant_staff_access($1, 'prestataire')`, [PRESTA]), "fiche prestataire");
await asAdmin(`SELECT grant_staff_access($1, 'prestataire', 'Jean Presta', $2)`, [PRESTA, p1.id]);
ok("compte prestataire lié à sa fiche", (await rows(asSuper(`SELECT user_id FROM providers WHERE id=$1`, [p1.id])))[0].user_id === PRESTA);
await rejects("une fiche ne se lie qu'à un compte", () => asAdmin(`SELECT grant_staff_access($1, 'prestataire', null, $2)`, [PRESTA2, p1.id]), "déjà liée");
const requests = await rows(asAdmin(`SELECT * FROM list_access_requests()`));
ok("demandes d'accès en attente listées", requests.some((r) => r.user_id === RANDO && r.requested_role === "commercial") && !requests.some((r) => r.user_id === PRESTA));
const staff = await rows(asAdmin(`SELECT * FROM list_staff_users()`));
ok("liste du staff avec e-mails et fiche", staff.find((s) => s.user_id === PRESTA)?.provider_name === "Presta Un");
await rejects("liste du staff réservée à la direction", () => asComm(`SELECT * FROM list_staff_users()`), "direction");
await rejects("recherche par e-mail réservée au service", () => asAdmin(`SELECT admin_find_user_by_email('x@y.fr')`), "permission denied");
await rejects("dernier admin non supprimable", () => asAdmin(`DELETE FROM staff_profiles WHERE user_id = $1`, [ADMIN]), "dernier");
await rejects("dernier admin non rétrogradable", () => asAdmin(`UPDATE staff_profiles SET role = 'commercial' WHERE user_id = $1`, [ADMIN]), "dernier");
await rejects("un commercial ne s'auto-promeut pas", async () => {
  const r = await asComm(`UPDATE staff_profiles SET role = 'admin' WHERE user_id = $1 RETURNING user_id`, [USERS.COMM]);
  if (r.rows.length === 0) throw new Error("aucune ligne modifiée (RLS)");
}, "RLS");

console.log("\n# Prestataire : lecture");
const seenInt = await rows(asPresta(`SELECT id FROM provider_interventions`));
ok("voit uniquement son intervention", seenInt.length === 1 && seenInt[0].id === i1.id, JSON.stringify(seenInt));
const seenCli = await rows(asPresta(`SELECT id FROM clients`));
ok("voit uniquement le client concerné", seenCli.length === 1 && seenCli[0].id === c1.id);
ok("voit uniquement l'installation concernée", (await rows(asPresta(`SELECT client_id FROM client_installations`))).every((r) => r.client_id === c1.id));
ok("ne voit pas les factures", (await rows(asPresta(`SELECT id FROM invoices`))).length === 0);
ok("ne voit pas les devis", (await rows(asPresta(`SELECT id FROM quotes`))).length === 0);
ok("ne voit pas les leads", (await rows(asPresta(`SELECT id FROM leads`))).length === 0);
ok("ne voit que sa fiche prestataire", (await rows(asPresta(`SELECT id FROM providers`))).map((r) => r.id).join() === p1.id);

console.log("\n# Prestataire : écriture");
await asPresta(`SELECT provider_update_intervention($1, 'in_progress', 'sur place')`, [i1.id]);
ok("peut démarrer + noter", (await rows(asSuper(`SELECT status, notes FROM interventions WHERE id=$1`, [i1.id])))[0].status === "in_progress");
// Plus aucun accès direct à la table : prix, affectation et statut ne se modifient que via la fonction
ok("table interventions : 0 ligne lisible en direct", (await rows(asPresta(`SELECT id FROM interventions`))).length === 0);
ok("la vue ne contient pas le prix", !Object.keys((await rows(asPresta(`SELECT * FROM provider_interventions`)))[0]).some((k) => /price|quote|created_by/.test(k)));
ok("UPDATE direct du prix : 0 ligne modifiée", (await asPresta(`UPDATE interventions SET price_ht = 1 WHERE id = $1`, [i1.id])).affectedRows === 0);
ok("UPDATE direct de l'affectation : 0 ligne modifiée", (await asPresta(`UPDATE interventions SET provider_id = $2 WHERE id = $1`, [i1.id, p2.id])).affectedRows === 0);
ok("le prix est intact", Number((await rows(asSuper(`SELECT price_ht FROM interventions WHERE id=$1`, [i1.id])))[0].price_ht) === 500);
await rejects("n'annule pas", () => asPresta(`SELECT provider_update_intervention($1, 'cancelled', null)`, [i1.id]), "démarrer ou terminer");
await rejects("intervention d'un autre : refusée", () => asPresta(`SELECT provider_update_intervention($1, 'in_progress', 'pirate')`, [i2.id]), "Accès refusé");
const other = { affectedRows: 0 };
ok("intervention d'un autre : 0 ligne modifiée", other.affectedRows === 0);
await rejects("ne crée pas d'intervention", () => asPresta(`INSERT INTO interventions (client_id) VALUES ($1)`, [c1.id]), "row-level security");
await asPresta(`INSERT INTO intervention_photos (intervention_id, client_id, kind, storage_path, uploaded_by) VALUES ($1, $2, 'before', 'x', $3)`, [i1.id, c2.id, PRESTA]);
ok("photo : client forcé = client de l'intervention", (await rows(asSuper(`SELECT client_id FROM intervention_photos WHERE intervention_id=$1`, [i1.id])))[0].client_id === c1.id);
await rejects("photo sur l'intervention d'un autre", () => asPresta(`INSERT INTO intervention_photos (intervention_id, client_id, kind, storage_path, uploaded_by) VALUES ($1, $2, 'before', 'x', $3)`, [i2.id, c2.id, PRESTA]), "row-level security");
await asPresta(`INSERT INTO intervention_reports (intervention_id, work_completed) VALUES ($1, 'Hotte dégraissée')`, [i1.id]);
ok("rapport sur son intervention", (await rows(asPresta(`SELECT id FROM intervention_reports`))).length === 1);
await rejects("rapport sur l'intervention d'un autre", () => asPresta(`INSERT INTO intervention_reports (intervention_id) VALUES ($1)`, [i2.id]), "row-level security");
ok("ne supprime pas un rapport", (await asPresta(`DELETE FROM intervention_reports WHERE intervention_id = $1`, [i1.id])).affectedRows === 0);
await asPresta(`SELECT provider_update_intervention($1, 'completed', 'fini')`, [i1.id]);
ok("terminée : horodatée + activité créée par la fonction", (await rows(asSuper(`SELECT completed_at FROM interventions WHERE id=$1`, [i1.id])))[0].completed_at !== null && (await rows(asSuper(`SELECT 1 FROM activities WHERE activity_type = 'INTERVENTION_COMPLETED' AND client_id = $1`, [c1.id]))).length === 1);
await rejects("intervention terminée verrouillée pour lui", () => asPresta(`SELECT provider_update_intervention($1, 'completed', 'modif')`, [i1.id]), "clôturée");
await asComm(`UPDATE interventions SET price_ht = 550 WHERE id = $1`, [i1.id]);
ok("le commercial garde la main", Number((await rows(asSuper(`SELECT price_ht FROM interventions WHERE id=$1`, [i1.id])))[0].price_ht) === 550);

console.log("\n# Prestataire : Storage");
await asPresta(`INSERT INTO storage.objects (bucket_id, name) VALUES ('intervention-photos', $1)`, [`${c1.id}/${i1.id}/a.jpg`]);
ok("upload dans le dossier de son intervention", true);
await rejects("upload dans le dossier d'un autre", () => asPresta(`INSERT INTO storage.objects (bucket_id, name) VALUES ('intervention-photos', $1)`, [`${c2.id}/${i2.id}/a.jpg`]), "row-level security");
await rejects("chemin invalide refusé", () => asPresta(`INSERT INTO storage.objects (bucket_id, name) VALUES ('intervention-photos', 'n-importe-quoi.jpg')`), "row-level security");
await rejects("pas d'accès aux documents clients", () => asPresta(`INSERT INTO storage.objects (bucket_id, name) VALUES ('client-documents', $1)`, [`${c1.id}/${i1.id}/a.pdf`]), "row-level security");
await asSuper(`INSERT INTO storage.objects (bucket_id, name) VALUES ('intervention-photos', $1)`, [`${c2.id}/${i2.id}/b.jpg`]);
ok("ne liste que ses fichiers", (await rows(asPresta(`SELECT name FROM storage.objects`))).every((r) => r.name.includes(i1.id)));

console.log("\n# Prestataire désactivé");
await asAdmin(`UPDATE providers SET status = 'inactive' WHERE id = $1`, [p1.id]);
ok("fiche inactive : plus aucun accès", (await rows(asPresta(`SELECT id FROM provider_interventions`))).length === 0);
await asAdmin(`UPDATE providers SET status = 'active' WHERE id = $1`, [p1.id]);
await asAdmin(`SELECT revoke_staff_access($1)`, [PRESTA]);
ok("accès retiré : plus aucun accès", (await rows(asPresta(`SELECT id FROM provider_interventions`))).length === 0);
ok("accès retiré : fiche déliée", (await rows(asSuper(`SELECT user_id FROM providers WHERE id=$1`, [p1.id])))[0].user_id === null);
ok("compte sans profil : rien", (await rows(as("authenticated", RANDO, `SELECT id FROM clients`))).length === 0);

console.log("\n# Formulaire public (anon)");
await asAnon(`INSERT INTO leads (email, company_name, status, assigned_user, notes, photos) VALUES ('Client@Resto.fr', 'Resto', 'won', $1, 'note interne', '["leads/abc.jpg", {"url":"https://abcd.supabase.co/storage/v1/object/x.jpg"}]')`, [ADMIN]);
const lead = (await rows(asSuper(`SELECT * FROM leads WHERE email = 'client@resto.fr'`)))[0];
ok("lead accepté, champs internes neutralisés", lead && lead.status === "new" && lead.assigned_user === null && lead.notes === null);
await rejects("doublon rapproché refusé", () => asAnon(`INSERT INTO leads (email) VALUES ('client@resto.fr')`), "déjà été reçue");
await rejects("ni e-mail ni téléphone", () => asAnon(`INSERT INTO leads (company_name) VALUES ('X')`), "e-mail ou un téléphone");
await rejects("e-mail invalide", () => asAnon(`INSERT INTO leads (email) VALUES ('pas-un-mail')`), "invalide");
await rejects("message trop long", () => asAnon(`INSERT INTO leads (email, message) VALUES ('a@b.fr', repeat('x', 6000))`), "trop long");
await rejects("photo data: refusée", () => asAnon(`INSERT INTO leads (email, photos) VALUES ('c@d.fr', '["data:image/png;base64,AAA"]')`), "non autorisé");
await rejects("photo hébergée ailleurs refusée", () => asAnon(`INSERT INTO leads (email, photos) VALUES ('e@f.fr', '[{"url":"https://evil.example/pixel.gif"}]')`), "formulaire");
ok("anon ne relit pas les leads", (await rows(asAnon(`SELECT id FROM leads`))).length === 0);
await db.exec(`INSERT INTO leads (email, created_at) SELECT 'flood' || g || '@x.fr', now() FROM generate_series(1, 30) g`);
await rejects("anti-flood global", () => asAnon(`INSERT INTO leads (email) VALUES ('nouveau@x.fr')`), "déjà été reçue");
await asComm(`UPDATE leads SET status = 'qualified', notes = 'rappeler' WHERE id = $1`, [lead.id]);
ok("le staff qualifie le lead normalement", (await rows(asSuper(`SELECT status, notes FROM leads WHERE id=$1`, [lead.id])))[0].notes === "rappeler");
await asSuper(`INSERT INTO leads (email, status) VALUES ('import@x.fr', 'qualified')`);
ok("import service non bridé", (await rows(asSuper(`SELECT status FROM leads WHERE email='import@x.fr'`)))[0].status === "qualified");

console.log("\n# Journal d'audit");
await asComm(`UPDATE clients SET city = 'Lyon' WHERE id = $1`, [c1.id]);
const audit = await rows(asAdmin(`SELECT * FROM audit_log WHERE table_name = 'clients' AND record_id = $1 AND action = 'UPDATE'`, [c1.id]));
ok("modification tracée avec auteur et diff", audit.length === 1 && audit[0].actor_id === USERS.COMM && audit[0].actor_role === "commercial" && audit[0].changes.city.new === "Lyon" && !("updated_at" in audit[0].changes), JSON.stringify(audit[0]));
ok("création de facture tracée", (await rows(asAdmin(`SELECT 1 FROM audit_log WHERE table_name = 'invoices' AND action = 'INSERT'`))).length === 1);
ok("changement de droits tracé", (await rows(asAdmin(`SELECT 1 FROM audit_log WHERE table_name = 'staff_profiles' AND action = 'DELETE'`))).length === 1);
ok("lead public tracé", (await rows(asAdmin(`SELECT 1 FROM audit_log WHERE table_name = 'leads' AND action = 'INSERT'`))).length >= 1);
ok("commercial ne lit pas l'audit", (await rows(asComm(`SELECT id FROM audit_log`))).length === 0);
await rejects("audit non modifiable par l'API", () => asAdmin(`DELETE FROM audit_log`), "permission denied");
await rejects("audit non modifiable même en SQL", () => asSuper(`DELETE FROM audit_log`), "lecture seule");

done();
