import assert from "node:assert/strict";

const required = [
  "PAYOUT_STAGING_DATABASE_URL",
  "PAYOUT_STAGING_BASE_URL",
  "PAYOUT_STAGING_TEST_PARTNER_ID",
  "PAYOUT_STAGING_TEST_ADMIN_ID",
];
const errors = [];
for (const key of required) if (!process.env[key]) errors.push(`${key} is required`);
const databaseUrl = process.env.PAYOUT_STAGING_DATABASE_URL ?? "";
const productionUrl = process.env.DATABASE_URL ?? "";
let db;
try { db = new URL(databaseUrl); } catch { if (databaseUrl) errors.push("staging database URL is invalid"); }
if (db) {
  if (!["postgres:", "postgresql:"].includes(db.protocol)) errors.push("staging database must use PostgreSQL");
  if (db.hostname === "localhost" || db.hostname === "127.0.0.1") errors.push("HTTP staging must use a separately provisioned database");
  if (databaseUrl === productionUrl) errors.push("staging database matches application DATABASE_URL");
  if (productionUrl) {
    try {
      const prod = new URL(productionUrl);
      if (db.hostname.toLowerCase() === prod.hostname.toLowerCase() && db.port === prod.port) errors.push("staging database shares the application database host");
    } catch { errors.push("application DATABASE_URL cannot be parsed for isolation comparison"); }
  }
}
let base;
try { base = new URL(process.env.PAYOUT_STAGING_BASE_URL ?? ""); } catch { if (process.env.PAYOUT_STAGING_BASE_URL) errors.push("staging URL is invalid"); }
if (base && base.protocol !== "https:") errors.push("staging URL must use HTTPS");
if (base && (base.hostname.toLowerCase() === "mypickup.kr" || base.hostname.toLowerCase().endsWith(".mypickup.kr"))) errors.push("production domain and its subdomains are forbidden");
if (base && (base.username || base.password)) errors.push("staging URL must not contain embedded credentials");
if (base && (base.search || base.hash)) errors.push("staging URL must not include query parameters or fragments");
if (process.env.PAYOUT_STAGING_SYNTHETIC_DATA_CONFIRMED !== "yes") errors.push("synthetic-only data must be confirmed");
if (process.env.PAYOUT_STAGING_NOTIFICATIONS_DISABLED !== "yes") errors.push("external notifications must be disabled");
if (process.env.PAYOUT_STAGING_ISOLATED_DB_CONFIRMED !== "yes") errors.push("isolated DB must be confirmed");
if (process.env.PAYOUT_KYC_ENFORCEMENT === "enabled" || process.env.PAYOUT_KYC_DOCUMENT_UPLOAD === "enabled") errors.push("KYC flags must remain disabled");
if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") errors.push("do not run staging preflight in production");
if (errors.length) {
  for (const error of errors) console.error("BLOCKED:", error);
  process.exitCode = 1;
} else {
  assert.ok(db && base);
  console.log("Payout staging preflight: configuration attestations passed. No network calls or payouts were performed.");
  console.log("Manual verification of resource isolation and test identities is still required.");
}
