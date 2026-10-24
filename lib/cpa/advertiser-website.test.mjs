import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("./advertiser-website.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, URL });
const { validAdvertiserWebsiteUrl } = exports;

test("accepts ordinary HTTPS and HTTP advertiser websites", () => {
  for (const value of ["https://example.com", "http://example.org/path?ref=campaign", "https://sub.example.com/"]) {
    assert.equal(validAdvertiserWebsiteUrl(value), true, value);
  }
});
test("rejects malformed, local, credentialed, and fragment URLs", () => {
  for (const value of ["", "example.com", "ftp://example.com", "https://user:pass@example.com", "https://example.com/#section", "http://localhost", "http://dev.localhost", "http://127.0.0.1", "http://0.0.0.0", "http://[::1]", "https://localhost./"]) {
    assert.equal(validAdvertiserWebsiteUrl(value), false, value);
  }
});
