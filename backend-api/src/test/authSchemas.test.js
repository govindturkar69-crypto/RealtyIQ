import test from "node:test";
import assert from "node:assert/strict";
import { changePasswordSchema, manageUserSchema, updateProfileSchema } from "../validators/auth.schema.js";

test("profile and password updates enforce minimum input", () => {
  assert.equal(updateProfileSchema.safeParse({ name: "A" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "short" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "new-pass-123" }).success, true);
});

test("user management requires a supported change", () => {
  assert.equal(manageUserSchema.safeParse({}).success, false);
  assert.equal(manageUserSchema.safeParse({ role: "owner" }).success, false);
  assert.equal(manageUserSchema.safeParse({ role: "admin" }).success, true);
  assert.equal(manageUserSchema.safeParse({ isActive: false }).success, true);
});
