import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getValidatedDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  // A dedicated synthetic payout runtime must fail closed before opening any DB connection.
  if (process.env.PAYOUT_TEST_PROJECT_ID) {
    if (
      process.env.PAYOUT_TEST_PROJECT_ID !== "orange-salad-93665842" ||
      process.env.PAYOUT_TEST_ISOLATION_CONFIRMED !== "yes" ||
      process.env.PAYOUT_EXTERNAL_EFFECTS_DISABLED !== "yes" ||
      process.env.VERCEL_ENV === "production"
    ) {
      throw new Error("PAYOUT_TEST_RUNTIME_ISOLATION_FAILED");
    }
    let target: URL;
    try {
      target = new URL(connectionString);
    } catch {
      throw new Error("PAYOUT_TEST_RUNTIME_DATABASE_INVALID");
    }
    if (
      !["postgres:", "postgresql:"].includes(target.protocol) ||
      !target.hostname.endsWith(".neon.tech") ||
      target.pathname !== "/mypickup_payout_test" ||
      target.searchParams.get("sslmode") !== "require" ||
      !target.username ||
      !target.password
    ) {
      throw new Error("PAYOUT_TEST_RUNTIME_DATABASE_INVALID");
    }
  }

  return connectionString;
}

export function getDb() {
  if (database) return database;
  const connectionString = getValidatedDatabaseUrl();
  const client = postgres(connectionString, { prepare: false });
  database = drizzle(client, { schema });
  return database;
}
