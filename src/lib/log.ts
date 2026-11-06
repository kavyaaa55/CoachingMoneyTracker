type Level = "info" | "warn" | "error";

/**
 * One JSON line per event, which any log service can search. Pass ids and counts only: no names,
 * phone numbers, notes or message text, because logs outlive the data they describe.
 */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (process.env.VITEST) return;

  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");
