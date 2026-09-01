import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { advertiserLedger, campaignRates, campaigns, clicks, conversionData, conversions } from "@/db/schema";
import { notifyAdmins, notifyAdvertiser } from "@/lib/notifications";
import { encryptPii } from "@/lib/security/pii";

const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const normalizePhone=(v:string)=>v.replace(/\D/g,"");
function kstBoundaries(){const now=new Date();const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);const month=date.slice(0,7);return{now,today:new Date(`${date}T00:00:00+09:00`),month:new Date(`${month}-01T00:00:00+09:00`)}};

export async function POST(request:Request){
  try{
    const body=await request.json();
    const campaignId=String(body.campaignId??"");
    const name=String(body.name??"").trim();
    const phone=normalizePhone(String(body.phone??""));
    if(!campaignId||!name||name.length>100||!/^01\d{8,9}$/.test(phone))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
    if(!body.privacy||!body.thirdParty)return Response.json({ok:false,error:"CONSENT_REQUIRED"},{status:400});

    const db=getDb();
    const cookieStore=await cookies();
    const clickCode=cookieStore.get("olbarun_click")?.value??null;
    const phoneHash=hash(phone);
    const {now,today,month}=kstBoundaries();

    const result=await db.transaction(async tx=>{
      await tx.execute(sql`select id from ${campaigns} where id=${campaignId} for update`);
      const[campaign]=await tx.select().from(campaigns).where(and(eq(campaigns.id,campaignId),eq(campaigns.type,"CPA"))).limit(1);
      if(!campaign)throw new Error("CAMPAIGN_NOT_FOUND");
      if(campaign.status!=="ACTIVE")throw new Error("CAMPAIGN_NOT_ACTIVE");
      if(campaign.startAt&&campaign.startAt>now)throw new Error("CAMPAIGN_NOT_STARTED");
      if(campaign.endAt&&campaign.endAt<now)throw new Error("CAMPAIGN_ENDED");

      const[rate]=await tx.select().from(campaignRates).where(eq(campaignRates.campaignId,campaignId)).limit(1);
      if(!rate)throw new Error("RATE_NOT_CONFIGURED");
      if(rate.advertiserRate<rate.partnerBaseRate+rate.minimumMargin)throw new Error("RATE_CONFIGURATION_INVALID");

      const[daily]=await tx.select({count:sql<number>`count(*)::int`,budget:sql<number>`coalesce(sum(${conversions.advertiserRateSnapshot}),0)::int`}).from(conversions).where(and(eq(conversions.campaignId,campaignId),gte(conversions.submittedAt,today)));
      const[monthly]=await tx.select({count:sql<number>`count(*)::int`,budget:sql<number>`coalesce(sum(${conversions.advertiserRateSnapshot}),0)::int`}).from(conversions).where(and(eq(conversions.campaignId,campaignId),gte(conversions.submittedAt,month)));
      const dailyCount=Number(daily?.count??0),monthlyCount=Number(monthly?.count??0),dailyBudget=Number(daily?.budget??0),monthlyBudget=Number(monthly?.budget??0);
      if(campaign.dailyConversionLimit&&dailyCount>=campaign.dailyConversionLimit)throw new Error("DAILY_CONVERSION_LIMIT_REACHED");
      if(campaign.monthlyConversionLimit&&monthlyCount>=campaign.monthlyConversionLimit)throw new Error("MONTHLY_CONVERSION_LIMIT_REACHED");
      if(campaign.dailyBudgetLimit&&dailyBudget+rate.advertiserRate>campaign.dailyBudgetLimit)throw new Error("DAILY_BUDGET_LIMIT_REACHED");
      if(campaign.monthlyBudgetLimit&&monthlyBudget+rate.advertiserRate>campaign.monthlyBudgetLimit)throw new Error("MONTHLY_BUDGET_LIMIT_REACHED");

      const[balanceRow]=await tx.select({balance:sql<number>`coalesce(sum(${advertiserLedger.amount}),0)::int`}).from(advertiserLedger).where(eq(advertiserLedger.advertiserId,campaign.advertiserId));
      const balance=Number(balanceRow?.balance??0);
      if(balance<rate.advertiserRate){await tx.update(campaigns).set({status:"PAUSED",updatedAt:new Date()}).where(eq(campaigns.id,campaignId));return{kind:"LOW_BALANCE" as const,advertiserId:campaign.advertiserId,campaignName:campaign.name};}

      const duplicateSince=new Date(now.getTime()-campaign.duplicateDays*86400000);
      const[duplicate]=await tx.select({id:conversionData.id}).from(conversionData).innerJoin(conversions,eq(conversionData.conversionId,conversions.id)).where(and(eq(conversions.campaignId,campaignId),eq(conversionData.customerPhoneHash,phoneHash),gte(conversions.submittedAt,duplicateSince))).limit(1);
      if(duplicate)throw new Error("DUPLICATE");

      let click:{id:string;partnerId:string;trackingLinkId:string}|undefined;
      if(clickCode)[click]=await tx.select({id:clicks.id,partnerId:clicks.partnerId,trackingLinkId:clicks.trackingLinkId}).from(clicks).where(and(eq(clicks.clickCode,clickCode),eq(clicks.campaignId,campaignId))).limit(1);

      const conversionCode=`CV-${randomBytes(7).toString("hex").toUpperCase()}`;
      const margin=rate.advertiserRate-rate.partnerBaseRate;
      const[conversion]=await tx.insert(conversions).values({conversionCode,campaignId,partnerId:click?.partnerId??null,trackingLinkId:click?.trackingLinkId??null,clickId:click?.id??null,status:"RECEIVED",advertiserRateSnapshot:rate.advertiserRate,partnerRateSnapshot:rate.partnerBaseRate,platformMarginSnapshot:margin,duplicateStatus:"NORMAL",fraudStatus:"NORMAL"}).returning();
      await tx.insert(conversionData).values({conversionId:conversion.id,customerName:name,customerPhoneEncrypted:encryptPii(phone),customerPhoneHash:phoneHash,region:String(body.region??"").trim().slice(0,160)||null,formData:{},privacyPolicyVersion:"privacy-v1",thirdPartyPolicyVersion:"third-party-v1",privacyAgreedAt:new Date(),thirdPartyAgreedAt:new Date()});
      return{kind:"CREATED" as const,advertiserId:campaign.advertiserId,campaignName:campaign.name,conversionCode};
    });

    if(result.kind==="LOW_BALANCE"){
      await Promise.all([notifyAdvertiser(result.advertiserId,{type:"BALANCE_LOW",title:"예치금 부족으로 캠페인이 중지되었습니다",message:`${result.campaignName} 캠페인의 예치금이 건당 광고비보다 부족해 자동 중지되었습니다.`,href:"/advertiser/ledger"}),notifyAdmins({type:"BALANCE_LOW",title:"광고주 예치금 부족",message:`${result.campaignName} 캠페인이 예치금 부족으로 자동 중지되었습니다.`,href:"/admin/advertisers"})]);
      return Response.json({ok:false,error:"ADVERTISER_BALANCE_INSUFFICIENT"},{status:409});
    }
    await notifyAdvertiser(result.advertiserId,{type:"NEW_CPA_DB",title:"새 CPA DB가 접수되었습니다",message:`${result.campaignName} 캠페인에 ${result.conversionCode} DB가 새로 접수되었습니다.`,href:"/advertiser/conversions"});
    return Response.json({ok:true,conversionCode:result.conversionCode},{status:201});
  }catch(error){
    const code=error instanceof Error?error.message:"CREATE_FAILED";
    console.error("Conversion create failed",error);
    if(code==="PII_ENCRYPTION_KEY_MISSING"||code==="PII_ENCRYPTION_KEY_INVALID")return Response.json({ok:false,error:"SERVICE_CONFIGURATION_ERROR"},{status:503});
    if(code==="CAMPAIGN_NOT_FOUND")return Response.json({ok:false,error:code},{status:404});
    if(["CAMPAIGN_NOT_ACTIVE","CAMPAIGN_NOT_STARTED","CAMPAIGN_ENDED","RATE_NOT_CONFIGURED","RATE_CONFIGURATION_INVALID","DAILY_CONVERSION_LIMIT_REACHED","MONTHLY_CONVERSION_LIMIT_REACHED","DAILY_BUDGET_LIMIT_REACHED","MONTHLY_BUDGET_LIMIT_REACHED","DUPLICATE"].includes(code))return Response.json({ok:false,error:code},{status:409});
    return Response.json({ok:false,error:"CREATE_FAILED"},{status:500});
  }
}
