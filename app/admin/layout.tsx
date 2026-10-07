import type {ReactNode} from "react";
import {requireAdmin} from "@/lib/auth/guards";
export default async function AdminLayout({children}:{children:ReactNode}){
  await requireAdmin();
  return children;
}
