import {build} from 'esbuild';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../..');
const originalFetch=globalThis.fetch,OriginalFormData=globalThis.FormData;
globalThis.FormData=class{constructor(){}get(name){return name}};
try{
 for(const name of ['SettlementRequest','PostingActionForm']){
 const out=path.join(dir,'compiled',name+'.cjs');
 await build({entryPoints:[path.join(repo,'components',name+'.tsx')],outfile:out,bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'mock'}));b.onResolve({filter:/^next\/navigation$/},()=>({path:'nav',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='react'?'export function useRef(v){return {current:v}};export function useState(v){return [v,()=>{}]}':'export function useRouter(){return {refresh(){globalThis.navigations++},push(){globalThis.navigations++}}}'}));}}]});
 const Component=createRequire(import.meta.url)(out).default;
 const fixture=()=>{globalThis.navigations=0;const tree=Component({available:1000,action:'apply',label:'참여',children:null});return (name==='SettlementRequest'?tree.props.children.find(x=>x?.type==='form'):tree).props.onSubmit};
 const event=()=>({preventDefault(){},currentTarget:{}});
 let submit=fixture(),resolve,calls=0;globalThis.fetch=()=>{calls++;return new Promise(r=>resolve=r)};
 const first=submit(event());await submit(event());assert.equal(calls,1,'rapid duplicate blocked');
 resolve({ok:true,redirected:true,json:async()=>({ok:true,settlementCode:'fixture'})});await first;await submit(event());assert.equal(calls,1,'success blocks retry while navigation pending');assert.ok(globalThis.navigations>0);
 for(const response of [()=>Promise.reject(new TypeError('network')),()=>Promise.resolve({ok:false,text:async()=>'NOT_ACTIVE',json:async()=>({ok:false,error:'NO_AVAILABLE_EARNINGS'})})]){
 submit=fixture();calls=0;globalThis.fetch=()=>{calls++;return response()};await submit(event());assert.equal(globalThis.navigations,0);assert.equal(calls,1,'no automatic retry');globalThis.fetch=async()=>{calls++;return {ok:true,redirected:true,json:async()=>({ok:true,settlementCode:'fixture'})}};await submit(event());assert.equal(calls,2,'failure releases lock');assert.ok(globalThis.navigations>0);
 }
 console.log('PASS '+name+': immediate duplicate guard, success lock, failure recovery, no automatic retry');
 }
}finally{globalThis.fetch=originalFetch;globalThis.FormData=OriginalFormData}
