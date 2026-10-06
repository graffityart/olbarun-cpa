import { scryptSync, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";

import {requireSameOrigin} from "@/lib/security/origin";

export const dynamic = "force-dynamic";

function verifyPassword(value: string, stored: string) {
  try {
    const [salt, expectedHex] = stored.split(":");
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(value, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    try { requireSameOrigin(request); } catch { return Response.json({ok:false,message:"요청을 확인할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."},{status:403}); }
    const { id } = await context.params;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({ok:false,message:"문의글을 찾을 수 없습니다."},{status:404});
    let body;
    try { body = await request.json(); } catch { return Response.json({ok:false,message:"비밀번호를 다시 입력해 주세요."},{status:400}); }
    if(!body||typeof body!=="object"||Array.isArray(body))return Response.json({ok:false,message:"비밀번호를 다시 입력해 주세요."},{status:400});
    const password = String(body.password || "");
    if(password.length<4||password.length>72)return Response.json({ok:false,message:"비밀번호는 4~72자로 입력해 주세요."},{status:400});
    const db = getDb();
    const [item] = await db.select().from(customerQna).where(eq(customerQna.id, id)).limit(1);
    if (!item) return Response.json({ ok: false, message: "문의글을 찾을 수 없습니다." }, { status: 404 });
    if (!verifyPassword(password, item.passwordHash)) return Response.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 403 });
    return Response.json({ ok: true, item: { id: item.id, nickname: item.nickname, title: item.title, content: item.content, status: item.status, answer: item.answer, answeredAt: item.answeredAt, createdAt: item.createdAt } }, {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    console.error("Q&A detail verification failed", error);
    return Response.json({ ok: false, message: "문의글 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
