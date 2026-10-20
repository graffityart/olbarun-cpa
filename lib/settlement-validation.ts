export const MAX_SETTLEMENT_AMOUNT = 2147483647;

export function isValidSettlementAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_SETTLEMENT_AMOUNT;
}

export function sumSettlementItems(amounts: readonly number[]): bigint | null {
  if (!amounts.length || amounts.some(amount => !isValidSettlementAmount(amount))) return null;
  const total = amounts.reduce((sum, amount) => sum + BigInt(amount), 0n);
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
