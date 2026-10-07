"use server";
import {eq} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {getDb} from "@/db";
import {customerQna,auditLogs} from "@/db/schema";
import {requireAdmin} from "@/lib/auth/guards";
type State={message:string;answer?:string};
export async function saveAnswer(id:string,_state:State,formData:FormData):Promise<State>{
  const admin=await requireAdmin();
  const answer=String(formData.get("answer")||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return {message:"문의글을 찾을 수 없습니다.",answer};
  if(answer.length<2||answer.length>5000)return {message:"답변은 2자 이상 5,000자 이하로 입력해 주세요.",answer};
  try{
    const now=new Date();
    const saved=await getDb().transaction(async tx=>{
      const [current]=await tx.select({answer:customerQna.answer}).from(customerQna).where(eq(customerQna.id,id)).for("update").limit(1);
      if(!current)return false;
      await tx.update(customerQna).set({answer,status:"ANSWERED",answeredAt:now,updatedAt:now}).where(eq(customerQna.id,id));
      await tx.insert(auditLogs).values({actorUserId:admin.id,action:current.answer?"CUSTOMER_ANSWER_UPDATED":"CUSTOMER_ANSWER_CREATED",targetType:"CUSTOMER_QNA",targetId:id,summary:current.answer?"고객 문의 답변 수정":"고객 문의 답변 등록",metadata:{previousAnswerLength:current.answer?.length??0,answerLength:answer.length}});
      return true;
    });
    if(!saved)return {message:"문의글을 찾을 수 없습니다. 목록에서 다시 확인해 주세요.",answer};
  }catch(error){console.error("Customer answer save failed",error);return {message:"답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",answer};}
  revalidatePath("/admin/customer");revalidatePath(`/admin/customer/${id}`);revalidatePath("/customer/qna");revalidatePath(`/customer/qna/${id}`);
  redirect(`/admin/customer/${id}?saved=1`);
}
