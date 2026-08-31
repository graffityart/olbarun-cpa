import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { advertisers, users } from "./core";

export const advertiserUsers = pgTable("advertiser_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  advertiserId: uuid("advertiser_id").notNull().references(() => advertisers.id),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  role: varchar("role", { length: 30 }).notNull().default("OWNER"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
