import crypto from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes");
assert.equal(process.env.PAYOUT_SYNTHETIC_SEED_CONFIRM, "synthetic-only");
assert.notEqual(process.env.NODE_ENV, "production");
assert.notEqual(process.env.VERCEL_ENV, "production");
assert.equal(process.env.PAYOUT_EXTERNAL_EFFECTS_DISABLED, "yes", "External email/SMS/payment/postbacks must be disabled");
const url = process.env.PAYOUT_TEST_DATABASE_URL;
assert.ok(url, "Dedicated test database URL required");
const u = new URL(url);
assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
assert.equal(u.pathname, "/mypickup_payout_test");
assert.ok(u.hostname.endsWith(".neon.tech"));
assert.equal(u.searchParams.get("sslmode"), "require");
if (process.env.DATABASE_URL) {
  assert.notEqual(u.hostname.toLowerCase(), new URL(process.env.DATABASE_URL).hostname.toLowerCase(), "Shared DB host forbidden");
}
const password = process.env.PAYOUT_SYNTHETIC_PASSWORD;
assert.ok(password && password.length >= 16, "Strong synthetic password required");
const hashPassword = value => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(value, salt, 64).toString("hex")}`;
};
const sql = postgres(url, { max: 1, connect_timeout: 8 });
try {
  const [identity] = await sql`select current_database() as db`;
  assert.equal(identity.db, "mypickup_payout_test");
  const required = ["users", "partners", "advertisers", "advertiser_users"];
  const tables = await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('users','partners','advertisers','advertiser_users')`;
  assert.deepEqual(tables.map(x => x.table_name).sort(), required.sort(), "Required schema is incomplete");
  const hash = hashPassword(password);
  await sql.begin(async tx => {
    for (const [email, role] of [["payout-admin@synthetic.invalid", "ADMIN"], ["payout-advertiser@synthetic.invalid", "ADVERTISER"], ["payout-partner@synthetic.invalid", "PARTNER"]]) {
      await tx`insert into users(email,password_hash,role,status,email_verified_at,updated_at) values (${email},${hash},${role}::user_role,'ACTIVE'::user_status,now(),now()) on conflict(email) do update set password_hash=excluded.password_hash,updated_at=now()`;
    }
    const [advUser] = await tx`select id from users where email='payout-advertiser@synthetic.invalid'`;
    const [adv] = await tx`insert into advertisers(advertiser_code,company_name,representative_name,contract_status,payment_type,updated_at) values ('SYNTH-PAYOUT-ADV','Synthetic test advertiser','Synthetic only','ACTIVE','PREPAID',now()) on conflict(advertiser_code) do update set updated_at=now() returning id`;
    await tx`insert into advertiser_users(advertiser_id,user_id,role) values(${adv.id},${advUser.id},'OWNER') on conflict(user_id) do update set advertiser_id=excluded.advertiser_id`;
    const [partnerUser] = await tx`select id from users where email='payout-partner@synthetic.invalid'`;
    await tx`insert into partners(user_id,partner_code,name,member_type,grade,approved_at,updated_at) values(${partnerUser.id},'SYNTH-PAYOUT-PARTNER','Synthetic test partner','INDIVIDUAL','NEW',now(),now()) on conflict(partner_code) do update set updated_at=now()`;
  });
  console.log("Synthetic-only accounts prepared in dedicated payout test DB");
} finally {
  await sql.end();
}
