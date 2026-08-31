import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["PARTNER", "ADVERTISER", "ADMIN", "SUPER_ADMIN"]);
export const userStatus = pgEnum("user_status", ["PENDING", "ACTIVE", "SUSPENDED", "WITHDRAWN"]);
export const campaignType = pgEnum("campaign_type", ["CPA", "POSTING"]);
export const campaignStatus = pgEnum("campaign_status", ["DRAFT", "REVIEW", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
export const conversionStatus = pgEnum("conversion_status", [
  "RECEIVED",
  "DELIVERED",
  "REVIEWING",
  "APPROVED",
  "REJECTION_REQUESTED",
  "REJECTED",
  "DISPUTED",
  "CANCELLED",
  "TEST",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    status: userStatus("status").notNull().default("PENDING"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({ emailIdx: uniqueIndex("users_email_unique").on(table.email) }),
);

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  partnerCode: varchar("partner_code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  memberType: varchar("member_type", { length: 30 }).notNull().default("INDIVIDUAL"),
  grade: varchar("grade", { length: 30 }).notNull().default("NEW"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const advertisers = pgTable("advertisers", {
  id: uuid("id").defaultRandom().primaryKey(),
  advertiserCode: varchar("advertiser_code", { length: 40 }).notNull().unique(),
  companyName: varchar("company_name", { length: 160 }).notNull(),
  businessNumber: varchar("business_number", { length: 30 }),
  representativeName: varchar("representative_name", { length: 100 }),
  websiteUrl: text("website_url"),
  contractStatus: varchar("contract_status", { length: 30 }).notNull().default("LEAD"),
  paymentType: varchar("payment_type", { length: 30 }).notNull().default("PREPAID"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignCode: varchar("campaign_code", { length: 50 }).notNull().unique(),
  advertiserId: uuid("advertiser_id").notNull().references(() => advertisers.id),
  type: campaignType("type").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  category: varchar("category", { length: 80 }),
  description: text("description"),
  status: campaignStatus("status").notNull().default("DRAFT"),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  dailyConversionLimit: integer("daily_conversion_limit"),
  monthlyConversionLimit: integer("monthly_conversion_limit"),
  dailyBudgetLimit: integer("daily_budget_limit"),
  monthlyBudgetLimit: integer("monthly_budget_limit"),
  duplicateDays: integer("duplicate_days").notNull().default(30),
  reviewDays: integer("review_days").notNull().default(7),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignRates = pgTable("campaign_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  advertiserRate: integer("advertiser_rate").notNull(),
  partnerBaseRate: integer("partner_base_rate").notNull(),
  minimumMargin: integer("minimum_margin").notNull().default(0),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const trackingLinks = pgTable("tracking_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  trackingCode: varchar("tracking_code", { length: 80 }).notNull().unique(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  subId: varchar("sub_id", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const clicks = pgTable("clicks", {
  id: uuid("id").defaultRandom().primaryKey(),
  clickCode: varchar("click_code", { length: 80 }).notNull().unique(),
  trackingLinkId: uuid("tracking_link_id").notNull().references(() => trackingLinks.id),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  partnerId: uuid("partner_id").notNull().references(() => partners.id),
  subId: varchar("sub_id", { length: 120 }),
  referrer: text("referrer"),
  landingUrl: text("landing_url"),
  ipHash: varchar("ip_hash", { length: 128 }),
  userAgent: text("user_agent"),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversions = pgTable("conversions", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversionCode: varchar("conversion_code", { length: 80 }).notNull().unique(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  partnerId: uuid("partner_id").references(() => partners.id),
  trackingLinkId: uuid("tracking_link_id").references(() => trackingLinks.id),
  clickId: uuid("click_id").references(() => clicks.id),
  status: conversionStatus("status").notNull().default("RECEIVED"),
  advertiserRateSnapshot: integer("advertiser_rate_snapshot").notNull(),
  partnerRateSnapshot: integer("partner_rate_snapshot").notNull(),
  platformMarginSnapshot: integer("platform_margin_snapshot").notNull(),
  duplicateStatus: varchar("duplicate_status", { length: 30 }).notNull().default("NORMAL"),
  fraudStatus: varchar("fraud_status", { length: 30 }).notNull().default("NORMAL"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversionData = pgTable("conversion_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversionId: uuid("conversion_id").notNull().references(() => conversions.id).unique(),
  customerName: varchar("customer_name", { length: 100 }),
  customerPhoneEncrypted: text("customer_phone_encrypted"),
  customerPhoneHash: varchar("customer_phone_hash", { length: 128 }),
  region: varchar("region", { length: 160 }),
  formData: jsonb("form_data").$type<Record<string, unknown>>().notNull().default({}),
  privacyPolicyVersion: varchar("privacy_policy_version", { length: 80 }),
  thirdPartyPolicyVersion: varchar("third_party_policy_version", { length: 80 }),
  privacyAgreedAt: timestamp("privacy_agreed_at", { withTimezone: true }),
  thirdPartyAgreedAt: timestamp("third_party_agreed_at", { withTimezone: true }),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
