/** Korean 10-digit business registration number checksum (format only; not registration status). */
export function validBusinessNumber(value: string): boolean {
  if (!/^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$/.test(value)) return false;
  const digits = value.replace(/-/g, "").split("").map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum = weights.reduce((total, weight, index) => total + digits[index] * weight, 0);
  const check = (10 - ((sum + Math.floor(digits[8] * 5 / 10)) % 10)) % 10;
  return check === digits[9];
}
