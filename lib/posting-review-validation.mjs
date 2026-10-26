export function validatePostingReviewInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "INVALID_JSON";
  const decision = typeof body.decision === "string" ? body.decision : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 2000) return "REASON_TOO_LONG";
  if (!["APPROVED", "REVISION_REQUESTED", "REJECTED"].includes(decision)) return "INVALID_DECISION";
  if (decision !== "APPROVED" && !reason) return "REASON_REQUIRED";
  return { decision, reason };
}
