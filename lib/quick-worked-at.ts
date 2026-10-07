export function parseQuickWorkedAt(value:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value))return null;
 const date=new Date(value);if(Number.isNaN(date.getTime()))return null;
 const local=new Date(date.getTime()+9*60*60*1000).toISOString().slice(0,19);
 return local===value.slice(0,19)?date:null;
}

export function quickWorkedAtInput(value:string|null|undefined):string{
 if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 return new Date(date.getTime()+9*60*60*1000).toISOString().slice(0,16);
}
