"use client";
import { useState } from "react";
export default function LogoutButton(){const[loading,setLoading]=useState(false);return <button className="secondary" disabled={loading} onClick={async()=>{setLoading(true);const res=await fetch("/api/auth/logout",{method:"POST"});if(res.ok)window.location.href="/login";else setLoading(false);}}>{loading?"로그아웃 중...":"로그아웃"}</button>}
