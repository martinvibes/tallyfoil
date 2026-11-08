import { randomUUID } from "node:crypto";

import { type ActionRunContext, fail } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";

/** The signed-in user's email; every row Tallyfoil reads or writes is scoped to it. */
export const ownerOf = (ctx?: ActionRunContext): string => {
  const email = ctx?.userEmail ?? getRequestUserEmail();
  if (!email) fail("Sign in to use Tallyfoil.", { errorCode: "unauthenticated", statusCode: 401 });
  return email;
};

/** Short, prefixed, collision-safe ids: "ven_3f9a…", "fnd_…". */
export const newId = (prefix: string): string => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

/**
 * The audit's "today" as an ISO date (UTC). `TALLYFOIL_AS_OF` pins it for
 * rehearsals and tests; production uses the real date.
 */
export const todayIso = (): string => process.env.TALLYFOIL_AS_OF ?? new Date().toISOString().slice(0, 10);

export const nowTimestamp = (): string => new Date().toISOString();
