export function eventDisplayStatus(event:{status:string;startsAt:Date|string|null;endsAt:Date|string|null},now=new Date()){
 if(event.status==='ENDED')return '종료';
 if(event.startsAt&&new Date(event.startsAt).getTime()>now.getTime())return '예정';
 if(event.endsAt&&new Date(event.endsAt).getTime()<now.getTime())return '종료';
 return '진행중';
}
