/** Validate a public-facing advertiser website URL without making network requests. */
export function validAdvertiserWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "0.0.0.0" || host === "127.0.0.1" || host === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}
