"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export async function saveAnswer(id:string,formData:FormData){
  await requireAdmin();
  const answer=String(formData.get("answer")||"").trim();
  if(answer.length<2||answer.length>5000) throw new Error("답변은 2자 이상 5000자 이하로 입력해주세요.");
  const db=getDb();
  await db.update(customerQna).set({answer,status:"ANSWERED",answeredAt:new Date(),updatedAt:new Date()}).where(eq(customerQna.id,id));
  revalidatePath("/admin/customer"); revalidatePath(`/admin/customer/${id}`); revalidatePath("/customer/qna"); revalidatePath(`/customer/qna/${id}`);
  redirect(`/admin/customer/${id}?saved=1`);
}
