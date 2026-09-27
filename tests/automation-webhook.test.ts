import { describe, expect, it } from "vitest";
import { verifyAutomationSecret } from "@/lib/automation-webhook";

describe("verifyAutomationSecret", () => {
  const secret = "s3cret-with-enough-length-0123456789";

  it("rejects when the server secret is not configured", () => {
    expect(verifyAutomationSecret(`Bearer ${secret}`, undefined)).toBe(
      "not_configured",
    );
    expect(verifyAutomationSecret(`Bearer ${secret}`, "")).toBe(
      "not_configured",
    );
  });

  it("rejects missing, malformed or wrong credentials", () => {
    expect(verifyAutomationSecret(null, secret)).toBe("unauthorized");
    expect(verifyAutomationSecret(secret, secret)).toBe("unauthorized");
    expect(verifyAutomationSecret("Bearer otro", secret)).toBe("unauthorized");
  });

  it("accepts the matching bearer secret", () => {
    expect(verifyAutomationSecret(`Bearer ${secret}`, secret)).toBe("ok");
  });
});
