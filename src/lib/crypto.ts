import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export function appSecret(): string {
  return process.env.APP_SECRET || "weddingos-demo-secret-change-me";
}

export function randomToken(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmacB64(data: string, secret = appSecret()): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(test, hash);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hashPin(pin: string): string {
  return hmacB64(`pin:${pin}`);
}
