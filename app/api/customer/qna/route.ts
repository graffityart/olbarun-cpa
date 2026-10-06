import { createHash, randomBytes, scryptSync } from "crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customerCaptcha, customerQna } from "@/db/schema";

import { requireSameOrigin } from "@/lib/security/origin";

const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const dynamic = "force-dynamic";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const passwordHash = (value: string) => { const salt = randomBytes(16).toString("hex"); const key = scryptSync(value, salt, 64).toString("hex"); return `${salt}:${key}`; };

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function spamScore(title: string, content: string) {
  const text = `${title} ${content}`;
  const links = (text.match(/https?:\/\//gi) || []).length;
  let score = links >= 3 ? 4 : links;
  if (/(카지노|바카라|토토|성인|대출문의).*(https?:\/\/)?/i.test(text)) score += 4;
  if (/(.)\1{12,}/.test(text)) score += 2;
  return score;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ id: customerQna.id, nickname: customerQna.nickname, title: customerQna.title, status: customerQna.status, isSecret: customerQna.isSecret, createdAt: customerQna.createdAt }).from(customerQna).orderBy(desc(customerQna.createdAt)).limit(50);
    return Response.json({ ok: true, items: rows });
  } catch (error) {
    console.error("Q&A list failed", error);
    return Response.json({ ok: false, items: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { requireSameOrigin(request); } catch { return Response.json({ok:false,message:"요청을 확인할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."}, {status:403}); }
    let body;
    try { body = await request.json(); } catch { return Response.json({ok:false,message:"입력 내용을 다시 확인해 주세요."},{status:400}); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ok:false,message:"입력 내용을 다시 확인해 주세요."},{status:400});
    const nickname = String(body.nickname || "").trim();
    const password = String(body.password || "");
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const captchaId = String(body.captchaId || "");
    const captchaAnswer = String(body.captchaAnswer || "").trim();
    const honeypot = String(body.website || "").trim();

    if (honeypot) return Response.json({ ok: false, message: "등록할 수 없습니다." }, { status: 400 });
    if (nickname.length < 2 || nickname.length > 40 || password.length < 4 || password.length > 72 || title.length < 2 || title.length > 160 || content.length < 5 || content.length > 5000) return Response.json({ ok: false, message: "입력 내용을 다시 확인해주세요." }, { status: 400 });
    if (!captchaId || !captchaAnswer) return Response.json({ ok: false, message: "스팸 방지 문제를 풀어주세요." }, { status: 400 });

    if (!validId(captchaId) || captchaAnswer.length > 10) return Response.json({ok:false,message:"새 스팸 방지 문제를 불러와 다시 입력해 주세요."},{status:400});
    const db = getDb();
    const [captcha] = await db.select().from(customerCaptcha).where(and(eq(customerCaptcha.id, captchaId), eq(customerCaptcha.used, false), gt(customerCaptcha.expiresAt, new Date()))).limit(1);
    if (!captcha || captcha.answerHash !== sha256(captchaAnswer)) return Response.json({ ok: false, message: "스팸 방지 답이 올바르지 않거나 만료되었습니다." }, { status: 400 });

    const ipHash = sha256(`${clientIp(request)}:${process.env.QNA_IP_SALT || "mypickup-qna"}`);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [recent] = await db.select({ count: sql<number>`count(*)` }).from(customerQna).where(and(eq(customerQna.ipHash, ipHash), gt(customerQna.createdAt, fiveMinutesAgo)));
    if (Number(recent?.count || 0) >= 3) return Response.json({ ok: false, message: "등록 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });

    const score = spamScore(title, content);
    if (score >= 5) return Response.json({ ok: false, message: "스팸으로 의심되는 내용이 포함되어 있습니다." }, { status: 400 });

    await db.transaction(async (tx) => {
      const consumed = await tx.update(customerCaptcha).set({used:true}).where(and(eq(customerCaptcha.id,captcha.id),eq(customerCaptcha.used,false),gt(customerCaptcha.expiresAt,new Date()))).returning({id:customerCaptcha.id});
      if (!consumed.length) throw new Error("CAPTCHA_USED");
      await tx.insert(customerQna).values({ nickname, passwordHash: passwordHash(password), title, content, isSecret: body.isSecret !== false, ipHash, userAgent: request.headers.get("user-agent")?.slice(0, 500) || null, spamScore: score });
    });

    return Response.json({ ok: true, message: "문의가 등록되었습니다." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CAPTCHA_USED") return Response.json({ok:false,message:"스팸 방지 문제가 이미 사용되었거나 만료되었습니다. 새 문제로 다시 시도해 주세요."},{status:400});
    console.error("Q&A registration failed", error);
    return Response.json({ ok: false, message: "문의 등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
