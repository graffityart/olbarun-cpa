import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=postgres(process.env.DATABASE_URL,{prepare:false,max:1});
try{
 const required={users:['id','role','status'],partners:['id','user_id'],earnings:['id','partner_id','conversion_id','posting_submission_id','type','amount','status','description','created_at']};
 const columns=await client`select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('users','partners','earnings','quick_jobs','quick_submissions') order by table_name,ordinal_position`;
 console.table(columns);
 for(const [table,names] of Object.entries(required))for(const name of names)if(!columns.some(c=>c.table_name===table&&c.column_name===name))throw new Error(`Required column missing: ${table}.${name}`);
 const existing=['quick_jobs','quick_submissions'].filter(t=>columns.some(c=>c.table_name===t));
 console.log('Quick tables:',existing.length?existing.join(', '):'not created');
 if(process.argv.includes('--apply')){
  if(existing.length)throw new Error('Quick tables already exist. Inspect their schema before any migration; refusing automatic changes.');
  await client.unsafe(await readFile(new URL('../db/migrations/0007_quick_jobs.sql',import.meta.url),'utf8'));
  console.log('Quick job migration applied. Existing CPA/posting tables were not altered.');
 }else console.log('Read-only check completed. No schema changes made.');
}finally{await client.end();}
