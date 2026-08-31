"use client";
import { useState } from "react";import { useRouter } from "next/navigation";
export default function ReadAllNotifications(){const[loading,setLoading]=useState(false);const router=useRouter();return <button className="secondary" disabled={loading} onClick={async()=>{setLoading(true);await fetch("/api/notifications/read-all",{method:"POST"});setLoading(false);router.refresh();}}>{loading?"처리 중...":"전체 읽음"}</button>}
