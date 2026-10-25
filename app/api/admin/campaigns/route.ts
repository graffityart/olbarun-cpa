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
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
    const input = body as Record<string, unknown>;
    if (input.type !== "CPA" && input.type !== "POSTING") return Response.json({ok:false,error:"INVALID_CAMPAIGN_TYPE"},{status:400});
    const type: "CPA" | "POSTING" = input.type;
    const data = input as Record<string, any>;
    if (typeof data.advertiserId !== "string" || typeof data.name !== "string") return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
    const advertiserId = data.advertiserId.trim(); const name = data.name.trim();
    if (Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return Response.json({ok:false,error:"INVALID_CAMPAIGN_NAME"},{status:400});
    if (!advertiserId || !name || name.length>200) return Response.json({ ok: false, error: "ADVERTISER_AND_NAME_REQUIRED" }, { status: 400 });
    const advertiserRate = Number(data.advertiserRate ?? 0); const partnerBaseRate = Number(data.partnerBaseRate ?? 0); const minimumMargin=Number(data.minimumMargin??Math.max(0,advertiserRate-partnerBaseRate));
    const duplicateDays = Number(data.duplicateDays ?? 30); const reviewDays = Number(data.reviewDays ?? 7);
    if (!Number.isSafeInteger(advertiserRate)||!Number.isSafeInteger(partnerBaseRate)||!Number.isSafeInteger(minimumMargin)||advertiserRate<0||partnerBaseRate<0||minimumMargin<0||partnerBaseRate+minimumMargin>advertiserRate)return Response.json({ok:false,error:"INVALID_RATE"},{status:400});
    if (!Number.isInteger(duplicateDays) || duplicateDays < 0 || !Number.isInteger(reviewDays) || reviewDays < 1) return Response.json({ ok:false,error:"INVALID_REVIEW_SETTINGS"},{status:400});
    const startAt=parseDate(data.startAt),endAt=parseDate(data.endAt);if(startAt&&endAt&&endAt<=startAt)return Response.json({ok:false,error:"INVALID_CAMPAIGN_PERIOD"},{status:400});
    const dailyConversionLimit=optionalPositiveInteger(data.dailyConversionLimit),monthlyConversionLimit=optionalPositiveInteger(data.monthlyConversionLimit),dailyBudgetLimit=optionalPositiveInteger(data.dailyBudgetLimit),monthlyBudgetLimit=optionalPositiveInteger(data.monthlyBudgetLimit);
    if(dailyConversionLimit&&monthlyConversionLimit&&dailyConversionLimit>monthlyConversionLimit)return Response.json({ok:false,error:"INVALID_CONVERSION_LIMIT"},{status:400});
    if(dailyBudgetLimit&&monthlyBudgetLimit&&dailyBudgetLimit>monthlyBudgetLimit)return Response.json({ok:false,error:"INVALID_BUDGET_LIMIT"},{status:400});
    const landingUrl=String(data.settings?.landingUrl??"").trim();if(landingUrl){try{const target=new URL(landingUrl);if(!["https:","http:"].includes(target.protocol)||target.username||target.password||!target.hostname||target.hostname==="localhost"||target.hostname.endsWith(".localhost"))throw new Error("INVALID_LANDING_URL");}catch{return Response.json({ok:false,error:"INVALID_LANDING_URL"},{status:400});}}
    const promoBanners=data.settings?.promoBanners;if(promoBanners!==undefined&&(!Array.isArray(promoBanners)||promoBanners.length>20||promoBanners.some((v:unknown)=>typeof v!=="string"||v.length>200000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(v))))return Response.json({ok:false,error:"INVALID_PROMO_BANNERS"},{status:400});
    const promoBanner=data.settings?.promoBanner;if(promoBanner!=null&&(typeof promoBanner!=="string"||promoBanner.length>200000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(promoBanner)))return Response.json({ok:false,error:"INVALID_PROMO_BANNER"},{status:400});
    const mainImage=data.settings?.mainImage;if(mainImage!=null&&(typeof mainImage!=="string"||mainImage.length>200000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(mainImage)))return Response.json({ok:false,error:"INVALID_CAMPAIGN_IMAGE"},{status:400});
    const db = getDb(); const [adv] = await db.select({id:advertisers.id}).from(advertisers).where(eq(advertisers.id, advertiserId)).limit(1);if(!adv)return Response.json({ok:false,error:"ADVERTISER_NOT_FOUND"},{status:404});
    const [campaign] = await db.insert(campaigns).values({campaignCode:makeCampaignCode(type),advertiserId,type,name,slug:makeSlug(name),category:String(data.category??"").trim().slice(0,80)||null,description:String(data.description??"").trim()||null,status:"DRAFT",startAt,endAt,dailyConversionLimit,monthlyConversionLimit,dailyBudgetLimit,monthlyBudgetLimit,duplicateDays,reviewDays,settings:data.settings??{}}).returning();
    if(advertiserRate||partnerBaseRate)await db.insert(campaignRates).values({campaignId:campaign.id,advertiserRate,partnerBaseRate,minimumMargin});
    if(type==="POSTING")await db.insert(postingCampaigns).values({campaignId:campaign.id,mediaType:String(data.mediaType??"BLOG"),participantLimit:optionalPositiveInteger(data.participantLimit),totalSubmissionLimit:optionalPositiveInteger(data.totalSubmissionLimit),perPartnerLimit:Number(data.perPartnerLimit??1),minimumCharacters:optionalPositiveInteger(data.minimumCharacters),minimumImages:optionalPositiveInteger(data.minimumImages),maintenanceDays:optionalPositiveInteger(data.maintenanceDays),reviewDays:Number(data.postingReviewDays??3),revisionLimit:Number(data.revisionLimit??2),rules:data.postingRules??{}});
    return Response.json({ok:true,campaign},{status:201});
  } catch(error){const code=error instanceof Error?error.message:"CREATE_FAILED";if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});if(code==="INVALID_LIMIT"||code==="INVALID_DATE")return Response.json({ok:false,error:code},{status:400});console.error("Failed to create campaign",error);return Response.json({ok:false,error:"CREATE_FAILED"},{status:500});}
}
