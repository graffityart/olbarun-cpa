export function loginDestination(next: string | undefined, role: string) {
 const base=role==='PARTNER'?'/partner':role==='ADVERTISER'?'/advertiser':'/admin';
 if(!next||!next.startsWith('/')||next.startsWith('//')||/[\\\u0000-\u001f]/.test(next))return base;
 try{const url=new URL(next,'https://local.invalid');if(url.origin!=='https://local.invalid')return base;const path=url.pathname;if(path===base||path.startsWith(base+'/')||path==='/notifications'||path==='/account/security')return url.pathname+url.search+url.hash;}catch{}
 return base;
}
