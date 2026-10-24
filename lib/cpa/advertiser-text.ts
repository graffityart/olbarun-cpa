/** Shared text-field validation for advertiser records. */
export function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

/** Undefined means invalid, null means omitted/blank. */
export function optionalAdvertiserText(value: unknown, maxLength: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string" || hasControlCharacters(value)) return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}
