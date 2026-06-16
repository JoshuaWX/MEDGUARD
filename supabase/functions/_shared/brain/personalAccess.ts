/**
 * MedGuard Brain v1 — Personal access gate
 *
 * SAFETY (Amendment #1): the intel function runs with JWT verification OFF, so
 * personal user-specific data (health_checkins, user_context, profile detail)
 * must NEVER be read unless a valid user JWT is present AND verified here.
 *
 * This module only RESOLVES whether a request is authenticated and, if so,
 * the verified user id. It performs no health-data reads itself (those happen
 * in Phase 3 via the user-scoped client) and it never logs tokens.
 */

import { createUserClient } from '../supabase.ts';

export interface PersonalAccess {
  /** True only when a JWT was supplied and verified to a real user id. */
  authenticated: boolean;
  userId: string | null;
}

/**
 * Verify the bearer JWT (if any) by asking Supabase Auth for the user.
 * Returns authenticated=false on any missing/invalid token. Never throws.
 */
export async function resolvePersonalAccess(req: Request): Promise<PersonalAccess> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { authenticated: false, userId: null };
  }

  try {
    const userClient = createUserClient(req);
    const { data, error } = await userClient.auth.getUser();
    const userId = data?.user?.id ?? null;
    if (error || !userId) {
      return { authenticated: false, userId: null };
    }
    return { authenticated: true, userId };
  } catch {
    // Any failure => treat as unauthenticated (area-only Brain).
    return { authenticated: false, userId: null };
  }
}
