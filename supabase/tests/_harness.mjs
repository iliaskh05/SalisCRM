// Harnais commun aux tests de migrations : Postgres embarqué (PGlite) + stubs des
// objets fournis par la plateforme Supabase (auth, rôles API, storage, realtime).
// Toutes les migrations du dossier sont jouées, socle leads / staff_profiles compris.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const MIG = fileURLToPath(new URL("../migrations", import.meta.url));

export const USERS = {
  ADMIN: "00000000-0000-0000-0000-00000000000a",
  COMM: "00000000-0000-0000-0000-00000000000c",
  PRESTA: "00000000-0000-0000-0000-0000000000b1",
  PRESTA2: "00000000-0000-0000-0000-0000000000b2",
  RANDO: "00000000-0000-0000-0000-00000000000f",
};

export async function createTestDb() {
  const db = new PGlite();

  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email varchar(255), created_at timestamptz DEFAULT now(),
      last_sign_in_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}'::jsonb
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

    CREATE PUBLICATION supabase_realtime;
  `);

  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIG, f), "utf8"));
    } catch (e) {
      console.log("MIGRATION FAIL", f, e.message, e.where ?? "");
      process.exit(2);
    }
    console.log("migrated", f);
  }

  const u = USERS;
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${u.ADMIN}', 'direction@test.fr', '{}'),
      ('${u.COMM}', 'commercial@test.fr', '{}'),
      ('${u.PRESTA}', 'presta1@test.fr', '{}'),
      ('${u.PRESTA2}', 'presta2@test.fr', '{}'),
      ('${u.RANDO}', 'inconnu@test.fr', '{"display_name":"Inconnu","requested_role":"commercial"}');
    INSERT INTO public.staff_profiles (user_id, role) VALUES ('${u.ADMIN}', 'admin'), ('${u.COMM}', 'commercial');
  `);

  let pass = 0;
  let fail = 0;

  async function as(role, uid, sql, params) {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
    if (role) await db.exec(`SET ROLE ${role}`);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("RESET ROLE");
    }
  }

  function ok(name, cond, extra = "") {
    if (cond) {
      pass++;
      console.log("  ✔", name);
    } else {
      fail++;
      console.log("  ✘", name, extra);
    }
  }

  async function rejects(name, fn, match) {
    try {
      await fn();
      fail++;
      console.log("  ✘", name, "(aucune erreur)");
    } catch (e) {
      const m = String(e.message);
      if (!match || m.includes(match)) {
        pass++;
        console.log("  ✔", name, "→", m);
      } else {
        fail++;
        console.log("  ✘", name, "→ message inattendu:", m);
      }
    }
  }

  function done() {
    console.log(`\n${pass} OK, ${fail} échec(s)`);
    process.exit(fail ? 1 : 0);
  }

  return {
    db,
    as,
    ok,
    rejects,
    done,
    asAdmin: (s, p) => as("authenticated", u.ADMIN, s, p),
    asComm: (s, p) => as("authenticated", u.COMM, s, p),
    asSuper: (s, p) => as(null, null, s, p),
  };
}
