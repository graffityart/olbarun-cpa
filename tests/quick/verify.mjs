import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const testDir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(testDir,'../..');process.chdir(testDir);const require=createRequire(import.meta.url);
const {drizzle}=require('drizzle-orm/pglite');
const db=new PGlite();
await db.exec((await readFile(path.join(repo,'db/migrations/0000_initial.sql'),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
await db.exec(await readFile(path.join(repo,'db/migrations/0003_posting_finance.sql'),'utf8'));
const migration=await readFile(path.join(repo,'db/migrations/0007_quick_jobs.sql'),'utf8');await db.exec(migration);await db.exec(migration);
const adapt=d=>new Proxy(d,{get(t,k){if(k==='execute')return async q=>(await t.execute(q)).rows;if(k==='transaction')return cb=>t.transaction(tx=>cb(adapt(tx)));const v=t[k];return typeof v==='function'?v.bind(t):v;}});
globalThis.quickTestDb=adapt(drizzle(db));
const admin=(await db.query(`insert into users(email,password_hash,role,status) values('admin@test','test','ADMIN','ACTIVE') returning id`)).rows[0].id;
async function partner(n){const u=(await db.query(`insert into users(email,password_hash,role,status) values($1,'test','PARTNER','ACTIVE') returning id`,[n+'@test'])).rows[0].id;const p=(await db.query(`insert into partners(user_id,partner_code,name) values($1,$2,$2) returning id`,[u,n])).rows[0].id;return {id:u,role:'PARTNER',status:'ACTIVE',partnerId:p};}
const a=await partner('a'),b=await partner('b');globalThis.quickTestUser={id:admin,role:'ADMIN',status:'ACTIVE'};
await mkdir('compiled',{recursive:true});
async function route(file,name){await build({entryPoints:[path.join(repo,file)],outfile:path.resolve('compiled/'+name+'.cjs'),nodePaths:[path.join(repo,'node_modules')],bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'mock-auth-db',setup(b){b.onResolve({filter:/^@\/lib\/notifications$/},()=>({path:'notifications',namespace:'test'}));b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/^@\/lib\/auth\/session$/},()=>({path:'auth',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='notifications'?'export async function notifyAdmins(){}':args.path==='db'?'export function getDb(){return globalThis.quickTestDb;}':'export async function getCurrentUser(){return globalThis.quickTestUser;}'}));b.onResolve({filter:/^@\//},args=>({path:path.join(repo,args.path.slice(2)+(args.path==='@/db/schema'?'/index.ts':'.ts'))}));}}]});return createRequire(import.meta.url)('./compiled/'+name+'.cjs');}
const manage=await route('app/api/admin/quick/route.ts','manage'),participate=await route('app/api/partner/quick/[id]/route.ts','participate'),review=await route('app/api/admin/quick/[id]/review/route.ts','review'),proof=await route('app/api/quick/proofs/[id]/[index]/route.ts','proof');
const settle=await route('app/api/partner/settlements/route.ts','settle');
const request=body=>new Request('https://test.local/api',{method:'POST',headers:body instanceof FormData?{origin:'https://test.local',host:'test.local'}:{origin:'https://test.local',host:'test.local','Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});
const config={title:'test job',category:'설문',description:'test',instructions:'test',notice:'test',target_url:'https://example.com',reward:500,capacity:1,status:'OPEN'};
let r=await manage.POST(request(config));assert.equal(r.status,200);const job=(await r.json()).id;
const ctx={params:Promise.resolve({id:job})};
const apply=()=>{const f=new FormData();f.set('action','apply');return request(f);};
globalThis.quickTestUser=a;r=await participate.POST(apply(),ctx);assert.equal(r.status,200);r=await participate.POST(apply(),ctx);assert.equal(r.status,200);assert.equal((await db.query('select count(*)::int as n from quick_submissions')).rows[0].n,1);
globalThis.quickTestUser=b;r=await participate.POST(apply(),ctx);assert.equal((await r.json()).error,'FULL');
globalThis.quickTestUser={id:admin,role:'ADMIN',status:'ACTIVE'};r=await manage.POST(request({...config,id:job,reward:900}));assert.equal(r.status,200);
function submission(count=3){const f=new FormData();for(const [k,v] of Object.entries({action:'submit',account:'myaccount',note:'complete',workedAt:'2026-10-01T10:00:00+09:00',agree:'on'}))f.set(k,v);for(let i=0;i<count;i++)f.append('proofs',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64')],'proof.png',{type:'image/png'}));return request(f);}
globalThis.quickTestUser=a;r=await participate.POST(submission(4),ctx);assert.equal((await r.json()).error,'IMAGE_LIMIT');r=await participate.POST(submission(),ctx);assert.equal(r.status,200);const sid=(await db.query('select id from quick_submissions')).rows[0].id;
globalThis.quickTestUser=b;r=await proof.GET(null,{params:Promise.resolve({id:sid,index:'0'})});assert.equal(r.status,404);
globalThis.quickTestUser=a;r=await proof.GET(null,{params:Promise.resolve({id:sid,index:'0'})});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
globalThis.quickTestUser={id:admin,role:'ADMIN',status:'ACTIVE'};const sc={params:Promise.resolve({id:sid})};r=await review.POST(request({decision:'REJECTED'}),sc);assert.equal((await r.json()).error,'REASON_REQUIRED');r=await review.POST(request({decision:'REJECTED',reason:'보완'}),sc);assert.equal(r.status,200);
globalThis.quickTestUser=a;r=await participate.POST(submission(),ctx);assert.equal(r.status,200);
globalThis.quickTestUser={id:admin,role:'ADMIN',status:'ACTIVE'};r=await review.POST(request({decision:'APPROVED'}),sc);assert.equal(r.status,200);r=await review.POST(request({decision:'APPROVED'}),sc);assert.equal((await r.json()).error,'LOCKED');
const rows=(await db.query('select amount,status,type from earnings')).rows;assert.equal(rows.length,1);assert.equal(rows[0].amount,500);assert.equal(rows[0].status,'AVAILABLE');assert.equal(rows[0].type,'QUICK_APPROVAL');
globalThis.quickTestUser=a;r=await settle.POST(request({amount:500,bankName:'test',accountNumber:'123',accountHolder:'test'}));assert.equal(r.status,201);assert.equal((await db.query("select status from earnings")).rows[0].status,'HOLD');assert.equal((await db.query('select count(*)::int as n from settlement_items')).rows[0].n,1);r=await settle.POST(request({amount:500,bankName:'test',accountNumber:'123',accountHolder:'test'}));assert.equal(r.status,409);
globalThis.quickTestUser=null;r=await manage.POST(request(config));assert.equal(r.status,401);
console.log('PASS: migration repeatability, capacity reservation, duplicate participation, reward snapshot, 3-image enforcement, proof authorization, rejection and resubmission, atomic approval, duplicate approval, existing earnings availability, existing settlement request and duplicate denial, anonymous denial');await db.close();

