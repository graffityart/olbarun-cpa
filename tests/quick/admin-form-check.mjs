import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(dir,'../..');
await mkdir(path.join(dir,'compiled'),{recursive:true});
const out=path.join(dir,'compiled/admin-form.cjs');
await build({entryPoints:[path.join(repo,'components/AdvertiserAccountManager.tsx')],outfile:out,bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'mock'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'nav',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='react'?'export function useRef(v){return {current:v}};export function useState(v){const slot=globalThis.formState.length;globalThis.formState.push(v);return [v,x=>{globalThis.formState[slot]=x}]}':'export function useRouter(){return {refresh(){globalThis.formRefresh++}}}'}));
}}]});
const Component=createRequire(import.meta.url)(out).default;
const originalFetch=globalThis.fetch,OriginalFormData=globalThis.FormData;
globalThis.FormData=class{constructor(form){this.values=form.values}get(name){return this.values[name]??null}};
function fixture(hasAccount=false){globalThis.formState=[];globalThis.formRefresh=0;const tree=Component({advertiserId:'fixture-id',hasAccount});const forms=tree.props.children.filter(Boolean);let resets=0;const form={values:{email:'fixture@example.com',password:'Fixture-password',amount:'1000',description:'테스트'},reset(){resets++}};return {forms,form,get resets(){return resets},event(){return{currentTarget:form,preventDefault(){}}}}}
try{
 for(const index of [0,1]){
  const f=fixture(),submit=f.forms[index].props.onSubmit;let resolve,calls=0;
  globalThis.fetch=()=>{calls++;return new Promise(r=>{resolve=r})};
  const event=f.event(),first=submit(event);event.currentTarget=null;
  await submit(f.event());await f.forms[1-index].props.onSubmit(f.event());assert.equal(calls,1,'double/cross-form submission blocked');
  resolve({ok:true,json:async()=>({ok:true,amount:1000})});await first;
  assert.equal(f.resets,1,'uses captured form after event expires');assert.equal(globalThis.formRefresh,1);assert.equal(globalThis.formState[2],false);
 }
 for(const response of [()=>Promise.reject(new TypeError('network')),()=>Promise.resolve({ok:true,json:async()=>{throw new SyntaxError('invalid response')}}),()=>Promise.resolve({ok:false,json:async()=>({ok:true,amount:1000})})]){
  const f=fixture(true),submit=f.forms[0].props.onSubmit;let calls=0;globalThis.fetch=()=>{calls++;return response()};
  await submit(f.event());assert.equal(globalThis.formState[2],false);assert.equal(f.resets,0);assert.equal(globalThis.formRefresh,0);assert.match(globalThis.formState[1],/장부/);assert.equal(calls,1,'no automatic retry');
  globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,amount:1000})});await submit(f.event());assert.equal(f.resets,1,'lock released after failure');
 }
 const f=fixture();globalThis.fetch=async()=>({ok:false,json:async()=>({ok:false,error:'EMAIL_ALREADY_EXISTS'})});await f.forms[0].props.onSubmit(f.event());assert.match(globalThis.formState[0],/이미 사용/);assert.equal(f.resets,0);
 console.log('PASS: captured form survives expired event; duplicate and cross-form submit guards; network/JSON/HTTP failure recovery; no automatic recharge; account error handling');
}finally{globalThis.fetch=originalFetch;globalThis.FormData=OriginalFormData}
