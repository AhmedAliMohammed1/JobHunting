import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/src/lib/auth/paths";
import { passwordUpdateSchema, registrationSchema, resetRequestSchema, signInSchema } from "@/src/lib/validation/auth";

describe("authentication validation", () => {
  it("accepts valid sign-in and account-creation credentials", () => {
    expect(signInSchema.safeParse({ email: "person@example.com", password: "password" }).success).toBe(true);
    expect(registrationSchema.safeParse({ email: "person@example.com", password: "a-secure-password" }).success).toBe(true);
  });

  it("rejects malformed emails and weak new passwords", () => {
    expect(resetRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(registrationSchema.safeParse({ email: "person@example.com", password: "short" }).success).toBe(false);
    expect(passwordUpdateSchema.safeParse({ password: "too-short" }).success).toBe(false);
  });

  it.each([
    ["https://evil.example", "/dashboard"],
    ["//evil.example/path", "/dashboard"],
    ["/\\evil", "/dashboard"],
    [null, "/dashboard"],
    ["/saved?from=login", "/saved?from=login"],
  ])("sanitizes the post-auth return path %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});
