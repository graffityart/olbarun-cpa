import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { conversions, users } from "./core";

/** Administrator review notes for CPA ledger reconciliation. Does not alter financial entries. */
export const cpaLedgerReviews = pgTable("cpa_ledger_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversionId: uuid("conversion_id").notNull().references(() => conversions.id),
  reviewerUserId: uuid("reviewer_user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 24 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("cpa_ledger_reviews_conversion_created_idx").on(table.conversionId, table.createdAt)]);
