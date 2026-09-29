import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const customerQna = pgTable("customer_qna", {
  id: uuid("id").defaultRandom().primaryKey(),
  nickname: varchar("nickname", { length: 40 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  content: text("content").notNull(),
  isSecret: boolean("is_secret").notNull().default(true),
  status: varchar("status", { length: 20 }).notNull().default("WAITING"),
  answer: text("answer"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  spamScore: integer("spam_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIdx: index("customer_qna_created_at_idx").on(table.createdAt),
  ipHashIdx: index("customer_qna_ip_hash_idx").on(table.ipHash),
}));

export const customerCaptcha = pgTable("customer_captcha", {
  id: uuid("id").defaultRandom().primaryKey(),
  answerHash: varchar("answer_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
