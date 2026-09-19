import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import mongoose from "mongoose";
import { deleteAccount } from "../controllers/auth.controller.js";
import { User } from "../models/User.js";
import { Prediction } from "../models/Prediction.js";
import { SavedSearch } from "../models/SavedSearch.js";
import { Inquiry } from "../models/Inquiry.js";
import { SecurityEvent } from "../models/SecurityEvent.js";

const ownerId = "507f1f77bcf86cd799439011";
const adminId = "507f1f77bcf86cd799439012";
const otherAdminId = "507f1f77bcf86cd799439013";
const originals = new Map();

function chain(value) {
  const query = {
    select: () => query,
    sort: () => query,
    session: () => query,
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return query;
}

function invoke(user = { _id: ownerId, role: "user", isActive: true }) {
  return new Promise((resolve) => {
    const setCookies = [];
    const response = {
      append(name, value) { if (name === "Set-Cookie") setCookies.push(value); },
      json(body) { resolve({ status: 200, body, setCookies }); },
    };
    deleteAccount({ user: { sub: String(user._id) } }, response, (error) => {
      resolve({ status: error?.statusCode || 500, error, setCookies });
    });
  });
}

function installMocks({ userById, admins = [], failAt }) {
  const session = {
    pending: [],
    committed: false,
    endSessionCalled: false,
    async withTransaction(work) {
      await work();
      this.committed = true;
    },
    async endSession() { this.endSessionCalled = true; },
  };
  const operation = (kind, filter) => {
    session.pending.push({ kind, filter });
    if (failAt === kind) throw new Error(`${kind} deletion failed`);
    return chain(undefined);
  };
  for (const [model, name, value] of [
    [User, "findById", (id) => typeof userById === "function" ? userById(String(id)) : userById],
    [User, "find", admins],
  ]) {
    originals.set(`${model.modelName}.${name}`, model[name]);
    model[name] = name === "findById" ? (id) => chain(value(id)) : () => chain(value);
  }
  for (const [model, name, fn] of [
    [Prediction, "deleteMany", (filter) => operation("Prediction", filter)],
    [SavedSearch, "deleteMany", (filter) => operation("SavedSearch", filter)],
    [Inquiry, "deleteMany", (filter) => operation("Inquiry", filter)],
    [User, "findByIdAndDelete", (id) => operation("User", { _id: id })],
    [User, "updateOne", (filter) => operation("UserAnchor", filter)],
  ]) {
    originals.set(`${model.modelName}.${name}`, model[name]);
    model[name] = fn;
  }
  originals.set("mongoose.startSession", mongoose.startSession);
  mongoose.startSession = async () => session;
  return session;
}

afterEach(() => {
  for (const [key, original] of originals) {
    if (key === "mongoose.startSession") mongoose.startSession = original;
    else {
      const [modelName, method] = key.split(".");
      const model = { User, Prediction, SavedSearch, Inquiry, SecurityEvent }[modelName];
      model[method] = original;
    }
  }
  originals.clear();
});

test("account deletion requires authentication", async () => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const csrf = await (await fetch(`${base}/api/auth/csrf`)).json();
    const response = await fetch(`${base}/api/auth/me`, {
      method: "DELETE",
      headers: { Cookie: `riq_csrf=${csrf.csrfToken}`, "X-CSRF-Token": csrf.csrfToken },
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("successful account deletion commits all owner-scoped deletions in one transaction", async () => {
  const session = installMocks({ userById: { _id: ownerId, role: "user", isActive: true } });
  try {
    const result = await invoke();
    assert.equal(result.status, 200);
    assert.equal(session.committed, true);
    assert.deepEqual(session.pending.map(({ kind, filter }) => [kind, filter]), [
      ["Prediction", { user: ownerId }],
      ["SavedSearch", { user: ownerId }],
      ["Inquiry", { user: ownerId }],
      ["User", { _id: ownerId }],
    ]);
    assert.equal(result.body.success, true);
    assert.equal(session.endSessionCalled, true);
    assert.equal(result.setCookies.length, 3);
    assert.ok(result.setCookies.every((cookie) => cookie.includes("Max-Age=0")));
  } finally {
    // restored by afterEach
  }
});

test("transaction abort leaves the user and related records untouched", async () => {
  const session = installMocks({ userById: { _id: ownerId, role: "user", isActive: true }, failAt: "SavedSearch" });
  try {
    const result = await invoke();
    assert.equal(result.status, 503);
    assert.equal(session.committed, false);
    assert.ok(session.pending.some(({ kind }) => kind === "Prediction"));
    assert.ok(!session.pending.some(({ kind }) => kind === "User"));
    assert.equal(session.endSessionCalled, true);
    assert.equal(result.setCookies.length, 0);
  } finally {
    // restored by afterEach
  }
});

test("unsupported transactions fail closed before any deletion", async () => {
  const session = installMocks({ userById: { _id: ownerId, role: "user", isActive: true } });
  session.withTransaction = async () => {
    throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
  };
  const result = await invoke();
  assert.equal(result.status, 503);
  assert.equal(session.pending.length, 0);
  assert.equal(session.committed, false);
  assert.equal(session.endSessionCalled, true);
  assert.equal(result.setCookies.length, 0);
});

test("last active admin cannot be deleted and no transaction writes occur", async () => {
  const session = installMocks({
    userById: { _id: adminId, role: "admin", isActive: true },
    admins: [{ _id: adminId }],
  });
  const result = await invoke({ _id: adminId, role: "admin", isActive: true });
  assert.equal(result.status, 400);
  assert.equal(session.committed, false);
  assert.equal(session.pending.length, 0);
  assert.equal(session.endSessionCalled, true);
});

test("account deletion remains owner-scoped", async () => {
  const session = installMocks({ userById: { _id: ownerId, role: "user", isActive: true } });
  await invoke();
  for (const { kind, filter } of session.pending) {
    if (["Prediction", "SavedSearch", "Inquiry"].includes(kind)) assert.equal(filter.user, ownerId);
    if (kind === "User") assert.equal(filter._id, ownerId);
  }
});

test("concurrent admin deletions fail closed on a transaction write conflict", async () => {
  let anchorUpdates = 0;
  const session = installMocks({
    userById: (id) => ({ _id: id, role: "admin", isActive: true }),
    admins: [{ _id: adminId }, { _id: otherAdminId }],
  });
  const originalUpdateOne = User.updateOne;
  User.updateOne = (filter) => {
    anchorUpdates += 1;
    if (anchorUpdates > 1) throw Object.assign(new Error("Write conflict"), { code: 112 });
    return chain(undefined);
  };
  try {
    const results = await Promise.all([
      invoke({ _id: adminId, role: "admin", isActive: true }),
      invoke({ _id: otherAdminId, role: "admin", isActive: true }),
    ]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 503]);
  } finally {
    User.updateOne = originalUpdateOne;
  }
});

test("account deletion does not delete SecurityEvent audit records", async () => {
  let touched = false;
  const originalDelete = SecurityEvent.deleteMany;
  SecurityEvent.deleteMany = () => { touched = true; };
  const session = installMocks({ userById: { _id: ownerId, role: "user", isActive: true } });
  try {
    assert.equal((await invoke()).status, 200);
    assert.equal(touched, false);
    assert.ok(session.pending.every(({ kind }) => kind !== "SecurityEvent"));
  } finally {
    SecurityEvent.deleteMany = originalDelete;
  }
});
