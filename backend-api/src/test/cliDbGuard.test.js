import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeCliTarget, CLI_DISPOSABLE_CONFIRMATION } from "../utils/cliDbGuard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const disposableEnv = {
  NODE_ENV: "development",
  REALTYIQ_DISPOSABLE_DB: "true",
  REALTYIQ_DISPOSABLE_DB_CONFIRM: CLI_DISPOSABLE_CONFIRMATION,
};

test("CLI guard rejects a production/public seed target", () => {
  assert.throws(() => assertSafeCliTarget({
    uri: "mongodb+srv://user:password@prod.example.mongodb.net/realtyiq",
    env: { ...disposableEnv, NODE_ENV: "production" },
    operation: "seed",
  }), /local disposable|allowlisted disposable/);
});

test("CLI guard rejects an Atlas target even when NODE_ENV is changed", () => {
  assert.throws(() => assertSafeCliTarget({
    uri: "mongodb+srv://user:password@disposable.example.mongodb.net/realtyiq_test",
    env: disposableEnv,
    operation: "seed",
  }), /local disposable|allowlisted disposable/);
});

test("CLI guard rejects missing or ambiguous target confirmation", () => {
  assert.throws(() => assertSafeCliTarget({
    env: disposableEnv,
    operation: "seed",
  }), /explicit MongoDB target/);
  assert.throws(() => assertSafeCliTarget({
    uri: "mongodb://127.0.0.1:27017/realtyiq_test",
    env: { NODE_ENV: "development", REALTYIQ_DISPOSABLE_DB: "true" },
    operation: "seed",
  }), /confirmation/);
  assert.throws(() => assertSafeCliTarget({
    uri: "mongodb://127.0.0.1:27017/other",
    env: disposableEnv,
    operation: "seed",
  }), /allowlisted disposable/);
});

test("CLI guard accepts an explicitly confirmed local disposable target", () => {
  const uri = "mongodb://127.0.0.1:27017/realtyiq_test";
  assert.equal(assertSafeCliTarget({ uri, env: disposableEnv, operation: "seed" }), uri);
});

test("Compose production mode still requires the explicit local disposable proof", () => {
  const uri = "mongodb://mongo:27017/realtyiq";
  assert.throws(() => assertSafeCliTarget({
    uri,
    env: { NODE_ENV: "production", REALTYIQ_DISPOSABLE_DB: "true" },
    operation: "seed",
  }), /confirmation/);
  assert.equal(assertSafeCliTarget({
    uri,
    env: { ...disposableEnv, NODE_ENV: "production" },
    operation: "seed",
  }), uri);
});

test("tracked seed material contains no literal passwords", () => {
  const seed = fs.readFileSync(path.join(root, "seed", "seed.js"), "utf8");
  const seedUsers = fs.readFileSync(path.join(root, "scripts", "seed-users.js"), "utf8");
  assert.doesNotMatch(seed, /setPassword\(\s*[\"'`]/);
  assert.doesNotMatch(seedUsers, /setPassword\(\s*[\"'`]/);
});

test("all privileged CLI writers import the shared target guard", () => {
  for (const file of ["seed/seed.js", "scripts/seed-users.js", "scripts/set-password.js", "scripts/bootstrap-admin.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /cliDbGuard\.js/);
    assert.match(source, /assertSafeCliTarget/);
  }
});
