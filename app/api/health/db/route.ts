import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute(sql`select now() as database_time`);
    const row = result[0] as { database_time?: string | Date } | undefined;

    return Response.json({
      ok: true,
      service: "olbarun-cpa",
      database: "connected",
      databaseTime: row?.database_time ?? null,
    });
  } catch (error) {
    console.error("Database health check failed", error);

    return Response.json(
      {
        ok: false,
        service: "olbarun-cpa",
        database: "disconnected",
      },
      { status: 503 },
    );
  }
}
