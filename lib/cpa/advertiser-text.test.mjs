import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("./advertiser-text.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { hasControlCharacters, optionalAdvertiserText } = exports;

test("normalizes optional advertiser text", () => {
  assert.equal(optionalAdvertiserText(null, 10), null);
  assert.equal(optionalAdvertiserText(undefined, 10), null);
  assert.equal(optionalAdvertiserText("  ", 10), null);
  assert.equal(optionalAdvertiserText("  회사명  ", 10), "회사명");
});
test("rejects invalid field types, oversized values, and control characters", () => {
  assert.equal(optionalAdvertiserText(123, 10), undefined);
  assert.equal(optionalAdvertiserText("abcdef", 5), undefined);
  for (const value of ["\tname", "name\n", "a\u0000b", "a\u007fb"]) {
    assert.equal(hasControlCharacters(value), true);
    assert.equal(optionalAdvertiserText(value, 100), undefined);
  }
});
