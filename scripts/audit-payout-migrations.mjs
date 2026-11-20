import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dir = "db/migrations";
const files = (await readdir(dir)).filter(x => x.endsWith(".sql")).sort();
if (!files.length) throw new Error("No SQL migrations found");
const risky = /\b(DROP\s+(?:TABLE|SCHEMA|COLUMN|TYPE|INDEX)|TRUNCATE|DELETE\s+FROM|UPDATE\s+\w+(?:\s+(?:AS\s+)?\w+)?\s+SET|INSERT\s+INTO|ALTER\s+TABLE|CREATE\s+OR\s+REPLACE|GRANT|REVOKE)\b/gi;
const report = [];
for (const file of files) {
  const sql = await readFile(join(dir, file), "utf8");
  const matches = [...sql.matchAll(risky)].map(m => ({
    operation: m[0].replace(/\s+/g, " ").toUpperCase(),
    line: sql.slice(0, m.index).split("\n").length,
  }));
  report.push({ file, bytes: Buffer.byteLength(sql), requiresManualReview: matches.length > 0, flaggedOperations: matches });
}
console.log(JSON.stringify({ migrations: report.length, report }, null, 2));
if (process.env.PAYOUT_MIGRATION_STRICT === "yes" && report.some(x => x.requiresManualReview)) {
  console.error("Migration review required before isolated test database application");
  process.exitCode = 2;
}
