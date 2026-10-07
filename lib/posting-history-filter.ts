export const postingHistoryStatuses={APPLIED:'참여신청',SUBMITTED:'검수대기',REVISION_REQUESTED:'수정요청',APPROVED:'승인완료',REJECTED:'거절',CANCELLED:'취소'};
export function parsePostingHistoryFilter(params:{q?:string|string[];status?:string|string[]}){
 const q=typeof params.q==='string'?params.q.trim().slice(0,100):'';
 const status=typeof params.status==='string'&&Object.hasOwn(postingHistoryStatuses,params.status)?params.status:'';
 return {q,status};
}
export function filterPostingHistory<T extends {campaignName:string;applicationStatus:string;submissionStatus:string|null}>(rows:T[],filter:{q:string;status:string}){
 const query=filter.q.toLocaleLowerCase('ko-KR');
 return rows.filter(row=>(!query||row.campaignName.toLocaleLowerCase('ko-KR').includes(query))&&(!filter.status||(row.submissionStatus??row.applicationStatus)===filter.status));
}
