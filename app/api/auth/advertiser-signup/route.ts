import {randomBytes} from 'node:crypto';
import {getDb} from '@/db';
import {advertisers,advertiserUsers,users} from '@/db/schema';
import {hashPassword} from '@/lib/auth/password';
import {requireSameOrigin} from '@/lib/security/origin';
export async function POST(request:Request){try{
 requireSameOrigin(request);const body=await request.json();const email=String(body.email??'').trim().toLowerCase(),password=String(body.password??''),companyName=String(body.companyName??'').trim(),name=String(body.name??'').trim(),businessNumber=String(body.businessNumber??'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>320||password.length<10||password.length>128||!companyName||companyName.length>160||!name||name.length>100||businessNumber.length>30)return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});
 const result=await getDb().transaction(async tx=>{const [user]=await tx.insert(users).values({email,passwordHash:hashPassword(password),role:'ADVERTISER',status:'PENDING'}).returning({id:users.id});const [advertiser]=await tx.insert(advertisers).values({advertiserCode:`ADV-${randomBytes(8).toString('hex').toUpperCase()}`,companyName,representativeName:name,businessNumber:businessNumber||null,contractStatus:'LEAD',paymentType:'PREPAID'}).returning({id:advertisers.id,code:advertisers.advertiserCode});await tx.insert(advertiserUsers).values({userId:user.id,advertiserId:advertiser.id,role:'OWNER'});return advertiser;});
 return Response.json({ok:true,advertiserCode:result.code,status:'PENDING'},{status:201});
}catch(error){const e=error as {code?:string;cause?:{code?:string}};if(e.code==='23505'||e.cause?.code==='23505')return Response.json({ok:false,error:'EMAIL_ALREADY_EXISTS'},{status:409});if(error instanceof SyntaxError)return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});if(error instanceof Error&&['INVALID_ORIGIN','ORIGIN_CHECK_FAILED'].includes(error.message))return Response.json({ok:false,error:error.message},{status:403});console.error('Advertiser signup failed',error);return Response.json({ok:false,error:'SIGNUP_FAILED'},{status:500});}}
