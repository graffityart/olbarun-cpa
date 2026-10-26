export type PostingReviewDecision = "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
export function validatePostingReviewInput(body: unknown): { decision: PostingReviewDecision; reason: string } | "INVALID_JSON" | "INVALID_DECISION" | "REASON_REQUIRED" | "REASON_TOO_LONG";
