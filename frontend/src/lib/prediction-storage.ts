export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false };

export function parseStoredPrediction<T>(
  raw: string | null,
  safeParse: (value: unknown) => SafeParseResult<T>,
): T | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
