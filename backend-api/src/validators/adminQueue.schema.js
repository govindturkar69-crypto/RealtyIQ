import { z } from "zod";

const MAX_PAGE = 100_000;
export const MAX_DATE_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier").transform((value) => value.toLowerCase());

function positiveQueryInt(defaultValue, max) {
  return z.preprocess(
    (value) => value === undefined ? String(defaultValue) : value,
    z.string().regex(/^[1-9]\d*$/, "Must be a positive integer").transform(Number).refine(Number.isSafeInteger, "Must be a safe integer").refine((value) => value <= max, `Must be at most ${max}`),
  );
}

const boundedText = (max) => z.string().trim().min(1).max(max);
function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

const dateText = z.string().trim().refine((value) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  return (dateOnly || iso) && validCalendarDate(value) && !Number.isNaN(Date.parse(value));
}, "Invalid date");

export function securityEventDateRangeIssues(value = {}, now = new Date()) {
  const from = value.from ? Date.parse(value.from) : undefined;
  const to = value.to ? Date.parse(value.to) + (/^\d{4}-\d{2}-\d{2}$/.test(value.to) ? 24 * 60 * 60 * 1000 : 0) : undefined;
  const referenceTime = new Date(now).getTime();
  const issues = [];
  if (from !== undefined && to !== undefined) {
    if (from >= to) issues.push({ path: ["to"], message: "to must be after from" });
    if (to - from > MAX_DATE_RANGE_MS) issues.push({ path: ["to"], message: "Date range cannot exceed 366 days" });
  }
  if (from !== undefined && to === undefined && referenceTime - from > MAX_DATE_RANGE_MS) {
    issues.push({ path: ["from"], message: "Date range cannot exceed 366 days" });
  }
  if (to !== undefined && from === undefined && referenceTime - to > MAX_DATE_RANGE_MS) {
    issues.push({ path: ["to"], message: "Date range cannot exceed 366 days" });
  }
  return issues;
}

export const adminInquiryQuerySchema = z.object({
  page: positiveQueryInt(1, MAX_PAGE),
  limit: positiveQueryInt(20, 100),
  status: z.enum(["new", "contacted", "closed"]).optional(),
}).strict();

export const securityEventQuerySchema = z.object({
  page: positiveQueryInt(1, MAX_PAGE),
  limit: positiveQueryInt(20, 100),
  type: boundedText(80).optional(),
  action: boundedText(80).optional(),
  resourceType: boundedText(40).optional(),
  result: boundedText(40).optional(),
  actorUserId: objectId.optional(),
  targetUserId: objectId.optional(),
  resourceId: objectId.optional(),
  requestId: boundedText(128).optional(),
  from: dateText.optional(),
  to: dateText.optional(),
}).strict().superRefine((value, context) => {
  securityEventDateRangeIssues(value).forEach(({ path, message }) => context.addIssue({ code: z.ZodIssueCode.custom, path, message }));
});

export function dateRangeValue(value, endOfDay = false) {
  const date = new Date(value);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
