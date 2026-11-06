export type Role = "parent" | "accounts";
export type AccessDecision = "allow" | "login" | "wrong-role";

/** Bump this when the consent notice changes, so parents are asked again. */
export const CONSENT_NOTICE_VERSION = "2026-11-v2";

export const homeFor = (role: Role) => (role === "parent" ? "/parent" : "/staff");

export function decideAccess(user: { role: Role } | null, required: Role): AccessDecision {
  if (!user) return "login";
  return user.role === required ? "allow" : "wrong-role";
}

export function missingConsents(studentIds: string[], consentedIds: string[]): string[] {
  const consented = new Set(consentedIds);
  return studentIds.filter((id) => !consented.has(id));
}
