import { destroySession } from "@/lib/auth/session";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Logout failed", error);
    return Response.json({ ok: false, error: "LOGOUT_FAILED" }, { status: 500 });
  }
}
