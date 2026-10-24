import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("./business-number.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { validBusinessNumber } = exports;

test("accepts valid checksum with and without hyphens", () => {
  assert.equal(validBusinessNumber("0000000000"), true);
  assert.equal(validBusinessNumber("000-00-00000"), true);
});
test("rejects malformed registration numbers and invalid checksums", () => {
  for (const value of ["123", "123456789", "12345678900", "0000000001", "000-00-00001", "abc-de-fghij", ""]) {
    assert.equal(validBusinessNumber(value), false, value);
  }
});
