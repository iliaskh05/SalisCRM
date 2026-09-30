// Génère src/lib/supabase/database.generated.ts (tables, vues, enums) à partir des
// MIGRATIONS : on les joue sur un Postgres embarqué puis on lit le catalogue.
// Le schéma versionné est donc la source de vérité, sans accès à un projet Supabase.
//
//   npm run types:gen     réécrit le fichier
//   npm run types:check   échoue si le fichier ne correspond plus aux migrations (CI)
//
// Les signatures des fonctions RPC restent écrites à la main dans types.ts (types de
// retour précis), seules les tables, vues et enums sont générées.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../supabase/tests/_harness.mjs";

const OUT = fileURLToPath(new URL("../src/lib/supabase/database.generated.ts", import.meta.url));
const check = process.argv.includes("--check");

// PostgREST déclare toutes les colonnes de vue nullables ; on précise celles qui ne le sont jamais.
const VIEW_NOT_NULL = {
  invoice_balances: ["invoice_id", "client_id", "total_ttc", "amount_paid", "amount_due", "status", "issued_at"],
  client_financial_summary: ["client_id", "total_invoiced", "total_paid", "amount_due"],
  provider_interventions: ["id", "client_id", "status", "created_at", "updated_at"],
};

const log = console.log;
console.log = () => {}; // silence le harnais (liste des migrations)
const { db } = await createTestDb();
console.log = log;

const { rows: columns } = await db.query(`
  SELECT c.table_name, c.column_name, c.is_nullable, c.column_default, c.data_type, c.udt_name,
         c.is_identity, t.table_type
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position`);

const { rows: enumRows } = await db.query(`
  SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname ORDER BY t.typname`);

const enums = new Map(enumRows.map((r) => [r.name, r.labels]));

function tsType(col) {
  const udt = col.udt_name;
  const isArray = col.data_type === "ARRAY";
  const base = isArray ? udt.replace(/^_/, "") : udt;
  let t;
  if (enums.has(base)) t = enums.get(base).map((l) => JSON.stringify(l)).join(" | ");
  else if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(base)) t = "number";
  else if (base === "bool") t = "boolean";
  else if (base === "json" || base === "jsonb") t = "Json";
  else if (["uuid", "text", "varchar", "bpchar", "name", "date", "time", "timetz", "timestamp", "timestamptz", "interval"].includes(base)) t = "string";
  else throw new Error(`Type SQL non géré : ${base} (${col.table_name}.${col.column_name})`);
  if (isArray) t = `(${t})[]`;
  return t;
}

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, { type: c.table_type, cols: [] });
  byTable.get(c.table_name).cols.push(c);
}

const line = (name, type, optional = false) => `          ${name}${optional ? "?" : ""}: ${type};`;
const tables = [];
const views = [];

for (const [name, { type, cols }] of byTable) {
  if (type === "VIEW") {
    const notNull = new Set(VIEW_NOT_NULL[name] ?? []);
    const row = cols.map((c) => line(c.column_name, `${tsType(c)}${notNull.has(c.column_name) ? "" : " | null"}`));
    views.push(`      ${name}: {\n        Row: {\n${row.join("\n")}\n        };\n        Relationships: [];\n      };`);
    continue;
  }
  const row = [], insert = [], update = [];
  for (const c of cols) {
    const nullable = c.is_nullable === "YES";
    const t = tsType(c);
    row.push(line(c.column_name, nullable ? `${t} | null` : t));
    const optional = nullable || c.column_default !== null || c.is_identity === "YES";
    insert.push(line(c.column_name, nullable ? `${t} | null` : t, optional));
    update.push(line(c.column_name, nullable ? `${t} | null` : t, true));
  }
  const fix = (l) => l.join("\n");
  tables.push(`      ${name}: {\n        Row: {\n${fix(row)}\n        };\n        Insert: {\n${fix(insert)}\n        };\n        Update: {\n${fix(update)}\n        };\n        Relationships: [];\n      };`);
}

const enumLines = [...enums].map(([name, labels]) => `      ${name}: ${labels.map((l) => JSON.stringify(l)).join(" | ")};`);

const output = `/* eslint-disable */
// AUTO-GÉNÉRÉ par scripts/gen-types.mjs à partir de supabase/migrations — ne pas modifier à la main.
// Régénérer : npm run types:gen   (la CI vérifie avec npm run types:check)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tables.join("\n")}
    };
    Views: {
${views.join("\n")}
    };
    Functions: Record<string, never>;
    Enums: {
${enumLines.join("\n")}
    };
    CompositeTypes: Record<string, never>;
  };
};
`;

const normalize = (s) => s.replace(/\r\n/g, "\n");
if (check) {
  const current = existsSync(OUT) ? normalize(readFileSync(OUT, "utf8")) : "";
  if (current !== output) {
    console.error("database.generated.ts n'est plus à jour avec les migrations. Lancez : npm run types:gen");
    process.exit(1);
  }
  console.log("Types à jour avec les migrations.");
} else {
  writeFileSync(OUT, output);
  console.log(`Écrit : ${OUT} (${tables.length} tables, ${views.length} vues, ${enums.size} enums)`);
}
process.exit(0);
