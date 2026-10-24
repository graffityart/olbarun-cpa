/** Validate a public-facing advertiser website URL without making network requests. */
export function validAdvertiserWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "[::1]" || host === "[::]") return false;
    const ipv4 = host.split(".");
    if (ipv4.length === 4 && ipv4.every((part) => /^[0-9]+$/.test(part))) {
      const [a, b] = ipv4.map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
