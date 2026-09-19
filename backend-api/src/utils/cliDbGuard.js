const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "mongo"]);
const LOCAL_DATABASES = new Set(["realtyiq", "realtyiq_dev", "realtyiq_test", "realtyiq_disposable"]);
const DISPOSABLE_CONFIRMATION = "DISPOSABLE_REALTYIQ_DATABASE";

function fail(operation, reason) {
  throw new Error(`Refusing ${operation}: ${reason}`);
}

function targetDetails(uri, operation) {
  if (typeof uri !== "string" || !uri.trim()) fail(operation, "an explicit MongoDB target is required");

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    fail(operation, "MongoDB target is invalid");
  }

  if (parsed.protocol !== "mongodb:") fail(operation, "only a local disposable MongoDB target is allowed");
  const host = parsed.hostname.toLowerCase();
  let database;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("/")[0];
  } catch {
    fail(operation, "MongoDB target is invalid");
  }
  if (!LOCAL_HOSTS.has(host) || !LOCAL_DATABASES.has(database)) {
    fail(operation, "target must be an allowlisted disposable database");
  }
  return { host, database };
}

export function assertSafeCliTarget({ uri = process.env.MONGODB_URI, env = process.env, operation = "CLI database operation" } = {}) {
  const target = targetDetails(uri, operation);
  if (env.REALTYIQ_DISPOSABLE_DB !== "true" || env.REALTYIQ_DISPOSABLE_DB_CONFIRM !== DISPOSABLE_CONFIRMATION) {
    fail(operation, "explicit disposable-database confirmation is required");
  }
  if (env.NODE_ENV === "production" && !LOCAL_HOSTS.has(target.host)) {
    fail(operation, "production database targets are not permitted");
  }
  return uri;
}

export const CLI_DISPOSABLE_CONFIRMATION = DISPOSABLE_CONFIRMATION;
