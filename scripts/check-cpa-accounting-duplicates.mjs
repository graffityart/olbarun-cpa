import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required for read-only CPA accounting diagnostics.");
  process.exitCode = 1;
} else {
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 2 });
  try {
    const tables = [
      { name: "advertiser_ledger", label: "advertiser debits" },
      { name: "earnings", label: "partner earnings" },
    ];
    let duplicates = 0;
    for (const table of tables) {
      const rows = await sql`
        select conversion_id, count(*)::integer as entries
        from ${sql(table.name)}
        where conversion_id is not null
        group by conversion_id
        having count(*) > 1
        order by entries desc, conversion_id
        limit 100
      `;
      duplicates += rows.length;
      console.log(JSON.stringify({ table: table.name, duplicates: rows, truncated: rows.length === 100 }, null, 2));
    }
    if (duplicates > 0) {
      console.error("Duplicate CPA conversion accounting records found. Do not apply unique indexes before reconciliation.");
      process.exitCode = 2;
    } else {
      console.log("No duplicate conversion IDs found in the two accounting tables.");
    }
  } catch (error) {
    console.error("Read-only accounting diagnostic failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
