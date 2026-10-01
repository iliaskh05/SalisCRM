// Valide les Factur-X produits par l'application avec Mustang (validateur open source de
// référence : Schematron EN 16931 + règles françaises BR-FR, et veraPDF pour le PDF/A-3).
//
//   npm run test:facturx
//
// Prérequis : Java 11+. Le jar de Mustang (~60 Mo) est téléchargé depuis Maven Central une
// seule fois dans .cache/mustang/ (empreinte SHA-1 vérifiée).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFacturXPdf } from "../src/lib/facturx/index.ts";
import { fixtures, loadAssets } from "./facturx-fixtures.mjs";

const VERSION = "2.26.0";
const BASE = `https://repo1.maven.org/maven2/org/mustangproject/Mustang-CLI/${VERSION}/Mustang-CLI-${VERSION}.jar`;
const CACHE = fileURLToPath(new URL("../.cache/mustang", import.meta.url));
const JAR = join(CACHE, `Mustang-CLI-${VERSION}.jar`);

const java = spawnSync("java", ["-version"], { encoding: "utf8" });
if (java.error || java.status !== 0) {
  console.error("Java est requis pour valider le Factur-X (java -version a échoué).");
  process.exit(1);
}

async function ensureJar() {
  if (existsSync(JAR)) return;
  mkdirSync(CACHE, { recursive: true });
  console.log(`Téléchargement de Mustang ${VERSION}…`);
  const [jar, sha1] = await Promise.all([fetch(BASE), fetch(`${BASE}.sha1`)]);
  if (!jar.ok || !sha1.ok) throw new Error("Téléchargement de Mustang impossible (Maven Central).");
  const bytes = Buffer.from(await jar.arrayBuffer());
  const expected = (await sha1.text()).trim().split(/\s+/)[0];
  const actual = createHash("sha1").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`Empreinte SHA-1 inattendue pour Mustang (${actual} ≠ ${expected}).`);
  writeFileSync(JAR, bytes);
}

function validate(file) {
  return new Promise((resolve) => {
    const child = spawn("java", ["-jar", JAR, "--action", "validate", "--source", file, "--no-notices", "--disable-file-logging"]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", () => resolve(out));
  });
}

await ensureJar();
const dir = join(tmpdir(), "saliscrm-facturx");
mkdirSync(dir, { recursive: true });
const assets = loadAssets();

const files = [];
for (const [name, doc] of Object.entries(fixtures())) {
  const { pdf } = await buildFacturXPdf(doc, assets, new Date("2026-09-30T10:00:00Z"));
  const path = join(dir, `${name}.pdf`);
  writeFileSync(path, pdf);
  files.push({ name, path });
}

let failed = 0;
const results = await Promise.all(files.map(async (f) => ({ ...f, out: await validate(f.path) })));
for (const { name, out } of results) {
  const m = out.match(/Parsed PDF:(\w+) XML:(\w+).*?Errors:\[([^\]]*)\]/);
  const ok = m && m[1] === "valid" && m[2] === "valid" && m[3].trim() === "";
  if (!ok) failed++;
  console.log(`${ok ? "  ✔" : "  ✘"} ${name}${m ? ` — PDF/A-3 ${m[1]}, XML ${m[2]}${m[3].trim() ? `, anomalies : ${m[3]}` : ""}` : " — sortie du validateur illisible"}`);
  if (!ok) console.log(out.split("\n").filter((l) => /ERROR|WARN|error type|warning type|FailedAssert/.test(l)).slice(0, 10).join("\n"));
}
console.log(failed ? `\n${failed} document(s) non conforme(s)` : `\n${files.length} documents conformes (PDF/A-3B + EN 16931 + règles françaises)`);
process.exit(failed ? 1 : 0);
