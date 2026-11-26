import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync("db/index.ts", "utf8");
const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "getValidatedDatabaseUrl");
assert.ok(fn);
const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const host = "ep-dry-frog-berkq3yn.c-9.us-east-2.aws.neon.tech";
const url = h => "postgresql://fake:fake@" + h + "/mypickup_payout_test?sslmode=require";
const verify = (databaseUrl, overrides={}) => vm.runInNewContext(js + "\ngetValidatedDatabaseUrl()", {URL, process:{env:{DATABASE_URL:databaseUrl,PAYOUT_TEST_PROJECT_ID:"orange-salad-93665842",PAYOUT_TEST_ISOLATION_CONFIRMED:"yes",PAYOUT_EXTERNAL_EFFECTS_DISABLED:"yes",VERCEL_ENV:"preview",...overrides}}});
for (const h of [host,host.replace(".c-9","-pooler.c-9")]) test("allows isolated host "+h,()=>assert.equal(verify(url(h)),url(h)));
for (const h of ["ep-other.neon.tech",host+":5433",host+".evil.invalid"]) test("rejects unsafe host "+h,()=>assert.throws(()=>verify(url(h)),/PAYOUT_TEST_RUNTIME_DATABASE_INVALID/));
test("rejects wrong database",()=>assert.throws(()=>verify(url(host).replace("mypickup_payout_test","production")),/PAYOUT_TEST_RUNTIME_DATABASE_INVALID/));
test("rejects production runtime",()=>assert.throws(()=>verify(url(host),{VERCEL_ENV:"production"}),/PAYOUT_TEST_RUNTIME_ISOLATION_FAILED/));
test("rejects disabled isolation",()=>assert.throws(()=>verify(url(host),{PAYOUT_TEST_ISOLATION_CONFIRMED:"no"}),/PAYOUT_TEST_RUNTIME_ISOLATION_FAILED/));
