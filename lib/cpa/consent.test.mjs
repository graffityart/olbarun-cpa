import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./consent.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {hasExplicitCpaConsent}=exports;
test("accepts explicit consent",()=>assert.equal(hasExplicitCpaConsent({privacy:true,thirdParty:true}),true));
test("rejects implicit, string and numeric consent",()=>{
 for(const value of [{privacy:"true",thirdParty:true},{privacy:1,thirdParty:true},{privacy:true,thirdParty:"yes"},{privacy:false,thirdParty:true},{privacy:true},null,[]]){
  assert.equal(hasExplicitCpaConsent(value),false);
 }
});
