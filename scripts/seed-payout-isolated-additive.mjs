import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

// Additive credentials for the isolated integration branch ONLY.
// Never alters the original synthetic accounts, their passwords, or sessions.
assert.equal(process.env.PAYOUT_TEST_PROJECT_ID, "orange-salad-93665842");
assert.equal(process.env.PAYOUT_TEST_BRANCH_ID, "br-falling-sunset-be4st6wz");
assert.equal(process.env.PAYOUT_TEST_ISOLATION_CONFIRMED, "yes");
assert.equal(process.env.PAYOUT_EXTERNAL_EFFECTS_DISABLED, "yes");
assert.equal(process.env.PAYOUT_ADDITIVE_SEED_CONFIRM, "isolated-additive-only");
assert.notEqual(process.env.NODE_ENV, "production");
assert.notEqual(process.env.VERCEL_ENV, "production");
assert.ok(!process.env.DATABASE_URL, "Do not seed from the application DATABASE_URL");

const url = process.env.PAYOUT_TEST_DATABASE_URL;
assert.ok(url, "Isolated DB URL required");
const target = new URL(url);
assert.ok(["postgres:", "postgresql:"].includes(target.protocol));
assert.ok(target.hostname.endsWith(".neon.tech"));
assert.equal(target.pathname, "/mypickup_payout_test");
assert.equal(target.searchParams.get("sslmode"), "require");
assert.ok(target.username && target.password);
assert.equal(target.port, "");
const expectedHost = process.env.PAYOUT_TEST_EXPECTED_HOST;
assert.ok(expectedHost && expectedHost.endsWith(".neon.tech"), "Expected isolated branch hostname required");
assert.equal(target.hostname, expectedHost, "Refusing to seed a different Neon branch host");

const password = process.env.PAYOUT_ADDITIVE_TEST_PASSWORD;
assert.ok(password && password.length >= 20, "Unique strong additive test password required");
const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const sql = postgres(url, { max: 1, connect_timeout: 8 });
try {
  await sql.begin(async tx => {
    const [identity] = await tx`select current_database() as db`;
    assert.equal(identity.db, "mypickup_payout_test");
    const [state] = await tx`select
      (select count(*)::int from settlements) as settlements,
      (select count(*)::int from users where email not like '%@synthetic.invalid') as real_users,
      (select count(*)::int from users where email in ('integration-admin@synthetic.invalid','integration-partner@synthetic.invalid')) as already_seeded`;
    assert.equal(state.settlements, 0, "Integration fixtures must start with zero settlements");
    assert.equal(state.real_users, 0, "Real users forbidden");
    assert.equal(state.already_seeded, 0, "Additive users already exist; refuse credential rotation");
    const [admin] = await tx`insert into users(email,password_hash,role,status,email_verified_at,updated_at)
      values ('integration-admin@synthetic.invalid',${passwordHash},'ADMIN'::user_role,'ACTIVE'::user_status,now(),now()) returning id`;
    const [partner] = await tx`insert into users(email,password_hash,role,status,email_verified_at,updated_at)
      values ('integration-partner@synthetic.invalid',${passwordHash},'PARTNER'::user_role,'ACTIVE'::user_status,now(),now()) returning id`;
    assert.ok(admin.id && partner.id);
    await tx`insert into partners(user_id,partner_code,name,member_type,grade,approved_at,updated_at)
      values (${partner.id},'SYNTH-PAYOUT-INTEGRATION','Isolated integration partner','INDIVIDUAL','NEW',now(),now())`;
  });
  console.log("Created additive synthetic integration identities; existing sessions and users preserved");
} finally {
  await sql.end();
}
