export type CpaCampaignStatusRow={campaign:string;status:string};
export type CpaCampaignSummary={campaign:string;total:number;pending:number;approved:number;rejected:number;approvalRate:number};
export function summarizeCpaCampaigns(rows:readonly CpaCampaignStatusRow[]):CpaCampaignSummary[]{
 const byCampaign=new Map<string,CpaCampaignSummary>();
 for(const row of rows){
  let summary=byCampaign.get(row.campaign);
  if(!summary){summary={campaign:row.campaign,total:0,pending:0,approved:0,rejected:0,approvalRate:0};byCampaign.set(row.campaign,summary);}
  summary.total++;
  if(row.status==="RECEIVED"||row.status==="DELIVERED"||row.status==="REVIEWING")summary.pending++;
  if(row.status==="APPROVED")summary.approved++;
  if(row.status==="REJECTED")summary.rejected++;
 }
 return [...byCampaign.values()].map(row=>({...row,approvalRate:row.total?Math.round(row.approved/row.total*1000)/10:0})).sort((a,b)=>b.pending-a.pending||b.total-a.total||a.campaign.localeCompare(b.campaign,"ko"));
}
