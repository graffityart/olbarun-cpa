import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { campaigns, partners } from "./core";

export const postingCampaigns = pgTable("posting_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id).unique(),
  mediaType: varchar("media_type", { length: 32 }).notNull(),
  participantLimit: integer("participant_limit"),
  totalSubmissionLimit: integer("total_submission_limit"),
  perPartnerLimit: integer("per_partner_limit").default(1).notNull(),
  minimumCharacters: integer("minimum_characters"),
  minimumImages: integer("minimum_images"),
  maintenanceDays: integer("maintenance_days"),
  reviewDays: integer("review_days").default(3).notNull(),
  revisionLimit: integer("revision_limit").default(2).notNull(),
  rules: jsonb("rules"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const postingApplications = pgTable("posting_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  postingCampaignId: uuid("posting_campaign_id").notNull().references(() => postingCampaigns.id),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  status: varchar("status", { length: 24 }).default("APPLIED").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const postingSubmissions = pgTable("posting_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => postingApplications.id),
  title: varchar("title", { length: 300 }),
  postUrl: text("post_url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  note: text("note"),
  status: varchar("status", { length: 24 }).default("SUBMITTED").notNull(),
  revisionCount: integer("revision_count").default(0).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const postingReviews = pgTable("posting_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => postingSubmissions.id),
  decision: varchar("decision", { length: 24 }).notNull(),
  reason: text("reason"),
  checklist: jsonb("checklist"),
  reviewedBy: uuid("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
