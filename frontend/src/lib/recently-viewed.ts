const KEY = "riq_recent";

export function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushRecent(id: string, max = 8) {
  if (typeof window === "undefined") return;
  const next = [id, ...getRecent().filter((x) => x !== id)].slice(0, max);
  localStorage.setItem(KEY, JSON.stringify(next));
}
