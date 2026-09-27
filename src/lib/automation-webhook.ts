import { createHash, timingSafeEqual } from "node:crypto";

export type SecretCheck = "ok" | "unauthorized" | "not_configured";

/**
 * Valida `Authorization: Bearer <secret>` contra AUTOMATION_WEBHOOK_SECRET.
 * Falla cerrado si el secreto no está configurado. Compara digests para que
 * el tiempo no dependa del largo ni del contenido.
 */
export function verifyAutomationSecret(
  authorization: string | null,
  secret: string | undefined,
): SecretCheck {
  if (!secret) return "not_configured";
  const match = authorization?.match(/^Bearer (.+)$/);
  if (!match) return "unauthorized";
  const given = createHash("sha256").update(match[1]).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected) ? "ok" : "unauthorized";
}
