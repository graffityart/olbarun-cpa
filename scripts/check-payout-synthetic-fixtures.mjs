import assert from "node:assert/strict";
import postgres from "postgres";

// Read-only inspection of synthetic identities and payout fixtures in the dedicated Neon project.
assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes");
assert.notEqual(process.env.NODE_ENV, "production");
assert.notEqual(process.env.VERCEL_ENV, "production");
const url = process.env.PAYOUT_TEST_DATABASE_URL;
assert.ok(url, "PAYOUT_TEST_DATABASE_URL required");
const u = new URL(url);
assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
assert.equal(u.pathname, "/mypickup_payout_test");
assert.ok(u.username && u.password);
assert.equal(u.port, "");
assert.ok(u.hostname.endsWith(".neon.tech"));
assert.equal(u.searchParams.get("sslmode"), "require");
if (process.env.DATABASE_URL) {
  assert.notEqual(u.hostname.toLowerCase(), new URL(process.env.DATABASE_URL).hostname.toLowerCase());
}
const db = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 2 });
try {
  await db`set default_transaction_read_only = on`;
  const [identity] = await db`select current_database() as name`;
  assert.equal(identity.name, "mypickup_payout_test");
  const users = await db`select email, role::text as role, status::text as status, password_hash like 'disabled$%' as login_disabled from users where email in ('payout-admin@synthetic.invalid','payout-advertiser@synthetic.invalid','payout-partner@synthetic.invalid')`;
  const roles = new Map(users.map(x => [x.email, x]));
  for (const [email, role] of [["payout-admin@synthetic.invalid","ADMIN"],["payout-advertiser@synthetic.invalid","ADVERTISER"],["payout-partner@synthetic.invalid","PARTNER"]]) {
    assert.equal(roles.get(email)?.role, role, `Missing or mismatched ${role}`);
    assert.equal(roles.get(email)?.status, "ACTIVE");
    assert.equal(roles.get(email)?.login_disabled, true, "Fixture credentials must remain disabled");
  }
  const [relations] = await db`select
    (select count(*)::int from advertiser_users au join users u on au.user_id=u.id join advertisers a on a.id=au.advertiser_id where u.email='payout-advertiser@synthetic.invalid' and a.advertiser_code='SYNTH-PAYOUT-ADV') as advertiser_links,
    (select count(*)::int from partners p join users u on u.id=p.user_id where u.email='payout-partner@synthetic.invalid' and p.partner_code='SYNTH-PAYOUT-PARTNER') as partner_links`;
  assert.equal(relations.advertiser_links, 1);
  assert.equal(relations.partner_links, 1);
  const [funds] = await db`select count(*)::int as count, coalesce(sum(e.amount),0)::int as total,
    count(*) filter (where e.status='AVAILABLE')::int as available
    from earnings e join partners p on p.id=e.partner_id
    where p.partner_code='SYNTH-PAYOUT-PARTNER' and e.description in ('SYNTHETIC-PAYOUT-EARNING-A','SYNTHETIC-PAYOUT-EARNING-B')`;
  assert.equal(funds.count, 2);
  assert.equal(funds.total, 20000);
  assert.equal(funds.available, 2);
  const [settlement] = await db`select count(*)::int as count from settlements s join partners p on p.id=s.partner_id where p.partner_code='SYNTH-PAYOUT-PARTNER'`;
  assert.equal(settlement.count, 0, "Synthetic payout should not leave live settlement records");
  console.log(JSON.stringify({ database: identity.name, syntheticUsers: users.length, loginDisabled: true, advertiserLinks: relations.advertiser_links, partnerLinks: relations.partner_links, earningCount: funds.count, availableAmount: funds.total, settlements: settlement.count, readOnly: true }));
} finally {
  await db.end();
}
