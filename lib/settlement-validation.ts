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
