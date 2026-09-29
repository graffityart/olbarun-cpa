import { createHash, randomInt } from "crypto";
import { getDb } from "@/db";
import { customerCaptcha } from "@/db/schema";

export const dynamic = "force-dynamic";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function GET() {
  const left = randomInt(1, 10);
  const right = randomInt(1, 10);
  const answer = String(left + right);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  try {
    const db = getDb();
    const [row] = await db.insert(customerCaptcha).values({
      answerHash: hash(answer),
      expiresAt,
    }).returning({ id: customerCaptcha.id });

    return Response.json({ ok: true, id: row.id, question: `${left} + ${right} = ?`, expiresIn: 300 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Captcha creation failed", error);
    return Response.json({ ok: false, message: "스팸 방지 문제를 생성하지 못했습니다." }, { status: 500 });
  }
}
