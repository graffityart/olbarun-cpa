export type CpaCampaignStatusRow={campaignId:string;campaign:string;status:string;advertiserRate?:number;partnerRate?:number};
export type CpaCampaignSummary={campaignId:string;campaign:string;total:number;pending:number;approved:number;rejected:number;approvalRate:number;approvedSpend:number;partnerEarnings:number;platformMargin:number};
export function summarizeCpaCampaigns(rows:readonly CpaCampaignStatusRow[]):CpaCampaignSummary[]{
 const byCampaign=new Map<string,CpaCampaignSummary>();
 for(const row of rows){
  let summary=byCampaign.get(row.campaignId);
  if(!summary){summary={campaignId:row.campaignId,campaign:row.campaign,total:0,pending:0,approved:0,rejected:0,approvalRate:0,approvedSpend:0,partnerEarnings:0,platformMargin:0};byCampaign.set(row.campaignId,summary);}
  summary.total++;
  if(row.status==="RECEIVED"||row.status==="DELIVERED"||row.status==="REVIEWING")summary.pending++;
  if(row.status==="APPROVED"){summary.approved++;const cost=row.advertiserRate??0;const earning=row.partnerRate??0;if(Number.isSafeInteger(cost)&&Number.isSafeInteger(earning)&&cost>=earning&&earning>=0){summary.approvedSpend+=cost;summary.partnerEarnings+=earning;summary.platformMargin+=cost-earning;}}
  if(row.status==="REJECTED")summary.rejected++;
 }
 return [...byCampaign.values()].map(row=>({...row,approvalRate:row.total?Math.round(row.approved/row.total*1000)/10:0})).sort((a,b)=>b.pending-a.pending||b.total-a.total||a.campaign.localeCompare(b.campaign,"ko"));
}
