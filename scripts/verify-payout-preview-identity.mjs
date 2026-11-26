import assert from "node:assert/strict";

export function verifyPreviewIdentity(deployment, hostname, commit) {
  assert.match(hostname, /^mypickup-payout-integration-isolated-[a-z0-9]+\.vercel\.app$/);
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(deployment.projectId ?? deployment.project?.id, "prj_FUz3cEPnss1fBzU6RTzCw8GUr0ic");
  assert.equal(deployment.url, hostname);
  assert.equal(deployment.target, null);
  assert.equal(deployment.readyState, "READY");
  assert.equal(deployment.meta?.githubCommitSha, commit);
  assert.equal(deployment.meta?.githubRepo, "olbarun-cpa");
  assert.equal(deployment.meta?.githubOrg, "graffityart");
  return true;
}

export async function fetchVerifiedPreview(hostname, commit, token, fetcher = fetch) {
  assert.match(hostname, /^mypickup-payout-integration-isolated-[a-z0-9]+\.vercel\.app$/);
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.ok(typeof token === "string" && token.trim(), "Vercel API token required");
  const endpoint = new URL("https://api.vercel.com/v13/deployments/" + encodeURIComponent(hostname));
  endpoint.searchParams.set("slug", "graffityart9988-2594s-projects");
  const response = await fetcher(endpoint, {headers:{authorization:"Bearer "+token,accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok, "Vercel deployment verification failed");
  return verifyPreviewIdentity(await response.json(), hostname, commit);
}
