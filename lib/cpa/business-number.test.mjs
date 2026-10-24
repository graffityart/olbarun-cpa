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
  for (const value of ["123", "123456789", "12345678900", "0000000001", "000-00-00001", "abc-de-fghij", "123-456-7890", "12345-67890", "000-0000000", "00000-00000", "000-0000-000", "000-00-00000 ", " 0000000000", ""]) {
    assert.equal(validBusinessNumber(value), false, value);
  }
});

test("rejects incorrect checksum for a nonzero nine-digit prefix", () => {
  const prefix = "123456789";
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const digits = prefix.split("").map(Number);
  const sum = weights.reduce((total, weight, index) => total + digits[index] * weight, 0);
  const check = (10 - ((sum + Math.floor(digits[8] * 5 / 10)) % 10)) % 10;
  assert.equal(validBusinessNumber(prefix + check), true);
  assert.equal(validBusinessNumber(prefix + ((check + 1) % 10)), false);
});
