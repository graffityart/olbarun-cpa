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
  for (const value of ["", "example.com", "ftp://example.com", "https://user:pass@example.com", "https://example.com/#section", "http://localhost", "http://dev.localhost", "http://127.0.0.1", "http://0.0.0.0", "http://[::1]", "https://localhost./", "http://10.1.2.3", "https://192.168.1.1", "http://172.16.0.1", "http://172.31.255.254", "http://169.254.169.254", "http://100.64.0.1", "http://224.0.0.1", "http://[fc00::1]", "http://[fe80::1]", "https://intranet", "http://printer", "http://nas.local", "https://api.internal", "https://example.test", "https://example.invalid"]) {
    assert.equal(validAdvertiserWebsiteUrl(value), false, value);
  }
});

test("accepts valid public domains with query parameters and ports", () => {
  for (const value of ["https://example.com:8443/landing?utm_source=cpa", "https://shop.example.co.kr", "http://8.8.8.8/"]) {
    assert.equal(validAdvertiserWebsiteUrl(value), true, value);
  }
});

test("rejects encoded loopback addresses and credential-only URLs", () => {
  for (const value of ["http://0x7f000001", "http://2130706433", "http://0177.0.0.1", "https://admin@example.com"]) {
    assert.equal(validAdvertiserWebsiteUrl(value), false, value);
  }
});
