export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("ORIGIN_CHECK_FAILED");
  const expected = `${proto}://${host}`;
  if (origin !== expected) throw new Error("INVALID_ORIGIN");
}
