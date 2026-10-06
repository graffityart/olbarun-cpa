export function notificationDestination(value:string|null){
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return '/notifications';
  try{const url=new URL(value,'https://local.invalid');if(url.origin==='https://local.invalid')return url.pathname+url.search+url.hash;}catch{}
  return '/notifications';
}
