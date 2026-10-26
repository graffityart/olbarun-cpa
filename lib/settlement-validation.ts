export const MAX_SETTLEMENT_AMOUNT = 2147483647;

export function isValidSettlementAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_SETTLEMENT_AMOUNT;
}

export function sumSettlementItems(amounts: readonly number[]): bigint | null {
  if (!amounts.length || amounts.some(amount => !isValidSettlementAmount(amount))) return null;
  const total = amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0));
  return total <= BigInt(MAX_SETTLEMENT_AMOUNT) ? total : null;
}

export function settlementAmountsMatch(
  amounts: readonly number[],
  requestedAmount: number,
  paymentAmount: number,
  deductionAmount: number,
): boolean {
  const total = sumSettlementItems(amounts);
  return total !== null &&
    isValidSettlementAmount(requestedAmount) &&
    isValidSettlementAmount(paymentAmount) &&
    Number.isSafeInteger(deductionAmount) &&
    deductionAmount >= 0 &&
    deductionAmount <= MAX_SETTLEMENT_AMOUNT &&
    total === BigInt(requestedAmount) &&
    BigInt(paymentAmount) + BigInt(deductionAmount) === total;
}

export type SettlementAction = "APPROVE" | "PAID" | "REJECT";
export type SettlementStatus = "REQUESTED" | "APPROVED" | "PAID" | "REJECTED";

export function canReviewSettlement(status: SettlementStatus, action: SettlementAction): boolean {
  return (status === "REQUESTED" && (action === "APPROVE" || action === "REJECT")) ||
    (status === "APPROVED" && action === "PAID");
}

export function isValidSettlementReviewRequest(value: unknown): value is {action: SettlementAction; transferConfirmed?: boolean} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (request.action !== "APPROVE" && request.action !== "PAID" && request.action !== "REJECT") return false;
  return request.action !== "PAID" || request.transferConfirmed === true;
}

export function isSettlementPending(status: string): boolean {
  return status === "REQUESTED" || status === "APPROVED";
}

export function canStartSettlement(statuses: readonly string[]): boolean {
  return !statuses.some(isSettlementPending);
}

/** Verify that the settlement contains unique earnings before money is released. */
export function hasUniqueSettlementEarnings(ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every(id => id.length > 0) && new Set(ids).size === ids.length;
}

/** Compare the current settlement state with persisted review audit actions. */
export function settlementAuditMatches(status: SettlementStatus, actions: readonly string[]): boolean {
  const reviews = actions.filter(action =>
    action === "SETTLEMENT_APPROVE" || action === "SETTLEMENT_PAID" || action === "SETTLEMENT_REJECT");
  const approvals = reviews.filter(action => action === "SETTLEMENT_APPROVE").length;
  const payments = reviews.filter(action => action === "SETTLEMENT_PAID").length;
  const rejections = reviews.filter(action => action === "SETTLEMENT_REJECT").length;
  if (status === "REQUESTED") return reviews.length === 0;
  if (status === "APPROVED") return approvals === 1 && payments === 0 && rejections === 0;
  if (status === "PAID") return approvals === 1 && payments === 1 && rejections === 0 &&
    reviews.indexOf("SETTLEMENT_APPROVE") < reviews.indexOf("SETTLEMENT_PAID");
  if (status === "REJECTED") return approvals === 0 && payments === 0 && rejections === 1;
  return false;
}

/** Classify the reason an audit history cannot justify its settlement status. */
export function settlementAuditIssue(status: SettlementStatus, actions: readonly string[]): string | null {
  const reviews = actions.filter(action =>
    action === "SETTLEMENT_APPROVE" || action === "SETTLEMENT_PAID" || action === "SETTLEMENT_REJECT");
  if (settlementAuditMatches(status, reviews)) return null;
  const approvals = reviews.filter(action => action === "SETTLEMENT_APPROVE").length;
  const payments = reviews.filter(action => action === "SETTLEMENT_PAID").length;
  const rejections = reviews.filter(action => action === "SETTLEMENT_REJECT").length;
  if (approvals > 1 || payments > 1 || rejections > 1) return "동일한 처리 기록이 중복되었습니다.";
  if (rejections && (approvals || payments)) return "승인·지급 기록과 반려 기록이 충돌합니다.";
  if (payments && approvals && reviews.indexOf("SETTLEMENT_PAID") < reviews.indexOf("SETTLEMENT_APPROVE")) {
    return "지급완료 기록이 승인 기록보다 먼저 작성되었습니다.";
  }
  if (status === "REQUESTED") return "검토대기 상태에 승인·지급·반려 기록이 존재합니다.";
  if (status === "APPROVED") return payments ? "지급대기 상태에 지급완료 기록이 존재합니다." : "승인 처리 기록이 없거나 일치하지 않습니다.";
  if (status === "PAID") return approvals === 0 ? "지급완료 상태의 승인 기록이 없습니다." : "지급완료 처리 기록이 없거나 일치하지 않습니다.";
  if (status === "REJECTED") return "반려 처리 기록이 없거나 일치하지 않습니다.";
  return "알 수 없는 정산 상태입니다.";
}
