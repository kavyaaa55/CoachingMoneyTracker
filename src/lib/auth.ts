import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { decideAccess, homeFor, missingConsents, type Role } from "@/domain/access";
import { env } from "./env";
import { readSession, SESSION_TTL_MS, signSession } from "./session";
import { childrenOf, consentedStudentIds } from "./students";

const SESSION_COOKIE = "session";
const PENDING_PHONE_COOKIE = "pending_phone";
const DEMO_CODE_COOKIE = "demo_code";
const PENDING_MAX_AGE = 10 * 60;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** The role always comes from the database, so a change applies on the next request. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = token ? readSession(token, env.SESSION_SECRET, Date.now()) : null;
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
});

/** Call this at the top of every protected page and server action. */
export async function requireUser(role: Role) {
  const user = await currentUser();
  const decision = decideAccess(user, role);

  if (decision === "login" || !user) redirect("/login");
  if (decision === "wrong-role") redirect(homeFor(user.role));
  return user;
}

/** A parent, plus their children. Blocks all student data until consent is recorded. */
export async function requireParent() {
  const user = await requireUser("parent");
  const children = await childrenOf(user.id);
  const consented = await consentedStudentIds(user.id);

  const missing = missingConsents(
    children.map((child) => child.id),
    consented,
  );
  if (missing.length > 0) redirect("/consent");

  return { user, children };
}

export async function startSession(userId: string) {
  const token = signSession(
    { userId, expiresAt: Date.now() + SESSION_TTL_MS },
    env.SESSION_SECRET,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function savePendingLogin(phone: string, code: string | null) {
  const store = await cookies();
  store.set(PENDING_PHONE_COOKIE, phone, { ...cookieOptions, maxAge: PENDING_MAX_AGE });

  if (env.DEMO_MODE && code) {
    store.set(DEMO_CODE_COOKIE, code, { ...cookieOptions, maxAge: PENDING_MAX_AGE });
  } else {
    store.delete(DEMO_CODE_COOKIE);
  }
}

export async function readPendingLogin() {
  const store = await cookies();
  return {
    phone: store.get(PENDING_PHONE_COOKIE)?.value ?? null,
    demoCode: env.DEMO_MODE ? (store.get(DEMO_CODE_COOKIE)?.value ?? null) : null,
  };
}

export async function clearPendingLogin() {
  const store = await cookies();
  store.delete(PENDING_PHONE_COOKIE);
  store.delete(DEMO_CODE_COOKIE);
}
