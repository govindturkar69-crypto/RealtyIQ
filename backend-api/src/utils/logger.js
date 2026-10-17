const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const current = levels[process.env.LOG_LEVEL] ?? levels.info;
const sensitiveKey = /authorization|cookie|csrf|jwt|password|secret|token|credential|connection|string|body|headers?/i;

function safeValue(value, key = "", depth = 0) {
  if (sensitiveKey.test(key)) return undefined;
  if (value instanceof Error) return { name: value.name || "Error" };
  if (typeof value === "string") return value.replace(/[\r\n]/g, " ").slice(0, 500);
  if (depth > 2 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, key, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, 30)
    .map(([childKey, childValue]) => [childKey, safeValue(childValue, childKey, depth + 1)])
    .filter(([, childValue]) => childValue !== undefined));
}

export function formatLog(level, event, fields = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "api",
    event,
    ...safeValue(fields),
  });
}

export function safePath(path = "") {
  return String(path).replace(/\/[A-Za-z0-9._~-]{32,}(?=\/|$)/g, "/:redacted");
}

function log(level, event, fields = {}) {
  if (levels[level] > current) return;
  const fn = level === "error" ? console.error : console.log;
  fn(formatLog(level, event, typeof fields === "object" && fields !== null ? fields : { message: fields }));
}

export const logger = {
  error: (...a) => log("error", ...a),
  warn: (...a) => log("warn", ...a),
  info: (...a) => log("info", ...a),
  debug: (...a) => log("debug", ...a),
};
