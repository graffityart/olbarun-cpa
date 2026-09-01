import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers, campaignRates, campaigns, postingCampaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";

export const dynamic = "force-dynamic";
function makeCampaignCode(type: "CPA" | "POSTING") { return `${type}-${Date.now().toString(36).toUpperCase()}`; }
function makeSlug(name: string) { return `${name.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`; }
const optionalPositiveInteger=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new Error("INVALID_LIMIT");return n;};
const parseDate=(value:unknown)=>{if(!value)return null;const d=new Date(String(value));if(Number.isNaN(d.getTime()))throw new Error("INVALID_DATE");return d;};

export async function GET() {
  await requireAdmin();
  try {
    const rows = await getDb().select({ id: campaigns.id, campaignCode: campaigns.campaignCode, type: campaigns.type, name: campaigns.name, status: campaigns.status, companyName: advertisers.companyName, createdAt: campaigns.createdAt }).from(campaigns).leftJoin(advertisers, eq(campaigns.advertiserId, advertisers.id)).orderBy(desc(campaigns.createdAt));
    return Response.json({ ok: true, campaigns: rows });
  } catch (error) { console.error("Failed to list campaigns", error); return Response.json({ ok: false, campaigns: [], error: "DATABASE_NOT_READY" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request); await requireAdmin();
    const body = await request.json();
    const type: "CPA" | "POSTING" = body.type === "POSTING" ? "POSTING" : "CPA";
    const advertiserId = String(body.advertiserId ?? "").trim(); const name = String(body.name ?? "").trim();
    if (!advertiserId || !name || name.length>200) return Response.json({ ok: false, error: "ADVERTISER_AND_NAME_REQUIRED" }, { status: 400 });
    const advertiserRate = Number(body.advertiserRate ?? 0); const partnerBaseRate = Number(body.partnerBaseRate ?? 0); const minimumMargin=Number(body.minimumMargin??Math.max(0,advertiserRate-partnerBaseRate));
    const duplicateDays = Number(body.duplicateDays ?? 30); const reviewDays = Number(body.reviewDays ?? 7);
    if (!Number.isSafeInteger(advertiserRate)||!Number.isSafeInteger(partnerBaseRate)||!Number.isSafeInteger(minimumMargin)||advertiserRate<0||partnerBaseRate<0||minimumMargin<0||partnerBaseRate+minimumMargin>advertiserRate)return Response.json({ok:false,error:"INVALID_RATE"},{status:400});
    if (!Number.isInteger(duplicateDays) || duplicateDays < 0 || !Number.isInteger(reviewDays) || reviewDays < 1) return Response.json({ ok:false,error:"INVALID_REVIEW_SETTINGS"},{status:400});
    const startAt=parseDate(body.startAt),endAt=parseDate(body.endAt);if(startAt&&endAt&&endAt<=startAt)return Response.json({ok:false,error:"INVALID_CAMPAIGN_PERIOD"},{status:400});
    const dailyConversionLimit=optionalPositiveInteger(body.dailyConversionLimit),monthlyConversionLimit=optionalPositiveInteger(body.monthlyConversionLimit),dailyBudgetLimit=optionalPositiveInteger(body.dailyBudgetLimit),monthlyBudgetLimit=optionalPositiveInteger(body.monthlyBudgetLimit);
    if(dailyConversionLimit&&monthlyConversionLimit&&dailyConversionLimit>monthlyConversionLimit)return Response.json({ok:false,error:"INVALID_CONVERSION_LIMIT"},{status:400});
    if(dailyBudgetLimit&&monthlyBudgetLimit&&dailyBudgetLimit>monthlyBudgetLimit)return Response.json({ok:false,error:"INVALID_BUDGET_LIMIT"},{status:400});
    const db = getDb(); const [adv] = await db.select({id:advertisers.id}).from(advertisers).where(eq(advertisers.id, advertiserId)).limit(1);if(!adv)return Response.json({ok:false,error:"ADVERTISER_NOT_FOUND"},{status:404});
    const [campaign] = await db.insert(campaigns).values({campaignCode:makeCampaignCode(type),advertiserId,type,name,slug:makeSlug(name),category:String(body.category??"").trim().slice(0,80)||null,description:String(body.description??"").trim()||null,status:"DRAFT",startAt,endAt,dailyConversionLimit,monthlyConversionLimit,dailyBudgetLimit,monthlyBudgetLimit,duplicateDays,reviewDays,settings:body.settings??{}}).returning();
    if(advertiserRate||partnerBaseRate)await db.insert(campaignRates).values({campaignId:campaign.id,advertiserRate,partnerBaseRate,minimumMargin});
    if(type==="POSTING")await db.insert(postingCampaigns).values({campaignId:campaign.id,mediaType:String(body.mediaType??"BLOG"),participantLimit:optionalPositiveInteger(body.participantLimit),totalSubmissionLimit:optionalPositiveInteger(body.totalSubmissionLimit),perPartnerLimit:Number(body.perPartnerLimit??1),minimumCharacters:optionalPositiveInteger(body.minimumCharacters),minimumImages:optionalPositiveInteger(body.minimumImages),maintenanceDays:optionalPositiveInteger(body.maintenanceDays),reviewDays:Number(body.postingReviewDays??3),revisionLimit:Number(body.revisionLimit??2),rules:body.postingRules??{}});
    return Response.json({ok:true,campaign},{status:201});
  } catch(error){const code=error instanceof Error?error.message:"CREATE_FAILED";if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});if(code==="INVALID_LIMIT"||code==="INVALID_DATE")return Response.json({ok:false,error:code},{status:400});console.error("Failed to create campaign",error);return Response.json({ok:false,error:"CREATE_FAILED"},{status:500});}
}
