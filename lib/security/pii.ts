import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey() {
  const raw = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("PII_ENCRYPTION_KEY_MISSING");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PII_ENCRYPTION_KEY_INVALID");
  return key;
}

export function encryptPii(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptPii(value: string) {
  if (!value.startsWith("v1:")) return value;
  const [, ivPart, tagPart, encryptedPart] = value.split(":");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("PII_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
}
