import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./review-guards.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {validCpaReviewRates,validCpaCampaignRates,canReviewCpaConversion,validCpaReviewReason,validCpaDebitBalance,validCpaEarningRecipient}=exports;
test("accepts balanced CPA snapshots",()=>{
 assert.equal(validCpaReviewRates(30000,20000,10000),true);
 assert.equal(validCpaReviewRates(10000,0,10000),true);
});
test("rejects mismatched, negative and non-integer CPA snapshots",()=>{
 for(const rates of [[30000,20000,9999],[30000,40000,-10000],[0,0,0],[100,10,-1],[100.5,10,90.5],[Infinity,10,20],[NaN,0,0]]){
  assert.equal(validCpaReviewRates(...rates),false);
 }
});
test("reviewing and advertiser rejection-requested conversions are eligible for admin review",()=>{
 assert.equal(canReviewCpaConversion("REVIEWING"),true);
 assert.equal(canReviewCpaConversion("REJECTION_REQUESTED"),true);
 for(const status of ["RECEIVED","DELIVERED","APPROVED","REJECTED","CANCELLED","TEST","DISPUTED"]){
  assert.equal(canReviewCpaConversion(status),false);
 }
});

test("rejects unsafe integer CPA accounting amounts",()=>{
 const max=Number.MAX_SAFE_INTEGER;
 assert.equal(validCpaReviewRates(2147483647,2147483647,0),true);
 assert.equal(validCpaReviewRates(max,max,0),false);
 assert.equal(validCpaReviewRates(2147483648,2147483647,1),false);
 assert.equal(validCpaReviewRates(2147483648,1,2147483647),false);
 assert.equal(validCpaReviewRates(max+1,1,max),false);
 assert.equal(validCpaReviewRates(100,Number.NaN,0),false);
 assert.equal(validCpaReviewRates(100,10,Infinity),false);
 assert.equal(validCpaReviewRates(100,-1,101),false);
});

test("CPA intake accepts valid campaign rates and minimum margins",()=>{
 assert.equal(validCpaCampaignRates(30000,20000,10000),true);
 assert.equal(validCpaCampaignRates(30000,20000,9999),true);
 assert.equal(validCpaCampaignRates(2147483647,2147483647,0),true);
});
test("CPA intake rejects overflowing, inconsistent and fractional rates",()=>{
 for(const rates of [[2147483648,1,0],[2147483647,2147483648,0],[2147483647,0,2147483648],[30000,20000,10001],[30000,30001,0],[30000,20000,-1],[30000,20000,0.5],[NaN,1,0]]){
  assert.equal(validCpaCampaignRates(...rates),false);
 }
});

test("CPA rejection requires a nonblank reason of at most 500 characters",()=>{
 assert.equal(validCpaReviewReason("REJECTED","고객 정보 불일치"),true);
 assert.equal(validCpaReviewReason("REJECTED","  "),false);
 assert.equal(validCpaReviewReason("REJECTED",undefined),false);
 assert.equal(validCpaReviewReason("REJECTED","a".repeat(500)),true);
 assert.equal(validCpaReviewReason("REJECTED","a".repeat(501)),false);
 assert.equal(validCpaReviewReason("REJECTED",123),false);
});
test("CPA approval permits no reason but rejects malformed input",()=>{
 assert.equal(validCpaReviewReason("APPROVED",undefined),true);
 assert.equal(validCpaReviewReason("APPROVED",""),true);
 assert.equal(validCpaReviewReason("APPROVED",{}),false);
 assert.equal(validCpaReviewReason("INVALID","ok"),false);
});

test("CPA debit balance boundaries",()=>{
 assert.equal(validCpaDebitBalance(30000,20000),true);
 assert.equal(validCpaDebitBalance(20000,20000),true);
 assert.equal(validCpaDebitBalance(19999,20000),false);
 assert.equal(validCpaDebitBalance(-1,1),false);
 assert.equal(validCpaDebitBalance(Number.NaN,1),false);
 assert.equal(validCpaDebitBalance(2147483649,1),false);
 assert.equal(validCpaDebitBalance(2147483648,1),true);
 assert.equal(validCpaDebitBalance(100,0),false);
});


test("CPA earnings require a real partner linkage when payout is positive",()=>{
 assert.equal(validCpaEarningRecipient(20000,"partner-1","user-1"),true);
 assert.equal(validCpaEarningRecipient(20000,null,"user-1"),false);
 assert.equal(validCpaEarningRecipient(20000,"partner-1",null),false);
 assert.equal(validCpaEarningRecipient(20000,"","user-1"),false);
 assert.equal(validCpaEarningRecipient(20000,"   ","user-1"),false);
 assert.equal(validCpaEarningRecipient(20000,"partner-1"," \t "),false);
 assert.equal(validCpaEarningRecipient(20000,"partner-1",""),false);
 assert.equal(validCpaEarningRecipient(0,null,null),true);
 assert.equal(validCpaEarningRecipient(-1,"partner-1","user-1"),false);
 assert.equal(validCpaEarningRecipient(1.5,"partner-1","user-1"),false);
});

test("CPA review rejects finalized statuses and case variants",()=>{
 for(const status of ["APPROVED","REJECTED","reviewing","ReviewING","rejection_requested","REJECTION_REQUESTED ","", "REVIEWING ", "PENDING"]){
  assert.equal(canReviewCpaConversion(status),false,status);
 }
});
test("CPA accounting never permits overdraw or unsafe balanceAfter",()=>{
 for(const [balance,rate] of [[0,1],[999,1000],[2147483648,0],[2147483649,1],[Number.MAX_SAFE_INTEGER,1],[100,101],[100,-1],[100,1.1]]){
  assert.equal(validCpaDebitBalance(balance,rate),false,`${balance}/${rate}`);
 }
 assert.equal(validCpaDebitBalance(2147483647,2147483647),true);
 assert.equal(validCpaDebitBalance(2147483648,2147483647),true);
});
test("CPA earnings recipient must be present for every positive payout",()=>{
 for(const amount of [1,10000,2147483647]){
  assert.equal(validCpaEarningRecipient(amount,null,null),false);
  assert.equal(validCpaEarningRecipient(amount,"partner","user"),true);
 }
});

test("CPA review reason normalizes whitespace and enforces boundaries",()=>{
 assert.equal(validCpaReviewReason("REJECTED","  고객 확인 필요  "),true);
 assert.equal(validCpaReviewReason("REJECTED","\n\t"),false);
 assert.equal(validCpaReviewReason("REJECTED"," ".repeat(10)+"a".repeat(500)+" ".repeat(10)),true);
 assert.equal(validCpaReviewReason("REJECTED"," ".repeat(10)+"a".repeat(501)+" ".repeat(10)),false);
 assert.equal(validCpaReviewReason("APPROVED",null),false);
 assert.equal(validCpaReviewReason("APPROVED","a".repeat(501)),false);
});
test("CPA accounting rejects unsafe payout recipients and ledger limits",()=>{
 for(const amount of [NaN,Infinity,-Infinity,2147483648]){
  assert.equal(validCpaEarningRecipient(amount,"partner","user"),false);
 }
 assert.equal(validCpaDebitBalance(2147483647,1),true);
 assert.equal(validCpaDebitBalance(2147483648,2),true);
 assert.equal(validCpaDebitBalance(2147483650,2),false);
 assert.equal(validCpaCampaignRates(100,90,10),true);
 assert.equal(validCpaCampaignRates(100,90,11),false);
});
