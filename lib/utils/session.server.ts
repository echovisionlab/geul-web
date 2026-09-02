import 'server-only';

import { cache } from 'react';
import { getSessionFromCookie } from '@/lib/auth';
import type { UserRole } from '@/lib/types/user/model';
import { toUserRole } from './validation';

/**
 * Get session (memoized per request)
 */
export const getSession = cache(async () => {
  return getSessionFromCookie();
});

/**
 * Get current user's ID (undefined if not authenticated)
 */
export async function getMemberId(): Promise<string | undefined> {
  const session = await getSession();
  return session?.user?.id;
}

/**
 * Get current user's role (undefined if not authenticated)
 */
export async function getUserRole(): Promise<UserRole | undefined> {
  const session = await getSession();
  return toUserRole(session?.user?.role, session?.user?.id) ?? undefined;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}
