import crypto from "node:crypto";
import postgres from "postgres";

if(process.env.SEED_TEST_USERS!=="true"){
 console.log("Test account seed skipped (SEED_TEST_USERS is not true)");
 process.exit(0);
}
const url=process.env.DATABASE_URL;
if(!url) throw new Error("DATABASE_URL is required");
const password=process.env.TEST_ACCOUNT_PASSWORD;
if(!password || password.length<8) throw new Error("TEST_ACCOUNT_PASSWORD must be at least 8 characters");
const sql=postgres(url,{max:1});
function hashPassword(value){const salt=crypto.randomBytes(16).toString("hex");const hash=crypto.scryptSync(value,salt,64).toString("hex");return `scrypt$${salt}$${hash}`;}
const hash=hashPassword(password);
const accounts=[{email:"test-admin@olbarunad.kr",role:"ADMIN"},{email:"test-advertiser@olbarunad.kr",role:"ADVERTISER"},{email:"test-partner@olbarunad.kr",role:"PARTNER"}];
try{
 await sql.begin(async tx=>{
  for(const a of accounts){await tx`insert into users (email,password_hash,role,status,email_verified_at,updated_at) values (${a.email},${hash},${a.role}::user_role,'ACTIVE'::user_status,now(),now()) on conflict (email) do update set password_hash=excluded.password_hash,role=excluded.role,status='ACTIVE'::user_status,email_verified_at=coalesce(users.email_verified_at,now()),updated_at=now()`;}
  const [advUser]=await tx`select id from users where email='test-advertiser@olbarunad.kr'`;
  const [adv]=await tx`insert into advertisers (advertiser_code,company_name,representative_name,contract_status,payment_type,updated_at) values ('TEST-ADVERTISER','테스트 광고주','테스트 담당자','ACTIVE','PREPAID',now()) on conflict (advertiser_code) do update set company_name=excluded.company_name,representative_name=excluded.representative_name,contract_status='ACTIVE',updated_at=now() returning id`;
  await tx`insert into advertiser_users (advertiser_id,user_id,role) values (${adv.id},${advUser.id},'OWNER') on conflict (user_id) do update set advertiser_id=excluded.advertiser_id,role='OWNER'`;
  const [partnerUser]=await tx`select id from users where email='test-partner@olbarunad.kr'`;
  await tx`insert into partners (user_id,partner_code,name,member_type,grade,approved_at,updated_at) values (${partnerUser.id},'TEST-PARTNER','테스트 파트너','INDIVIDUAL','NEW',now(),now()) on conflict (partner_code) do update set user_id=excluded.user_id,name=excluded.name,approved_at=coalesce(partners.approved_at,now()),updated_at=now()`;
 });
 console.log("Test accounts seeded: admin, advertiser, partner");
} finally {await sql.end();}
