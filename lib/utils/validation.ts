import type { UserRole } from '@/lib/types/user/model';
import { userRoleSchema } from '@/lib/types/user/schema';
import { createLogger } from './logger';

const logger = createLogger('validation');
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Accept only the lowercase hyphenated UUID representation used by the API.
 */
export function isValidUuid(value: string): boolean {
  return canonicalUuidPattern.test(value);
}

/**
 * Parse and validate user role.
 * - Valid role → returns as-is
 * - Invalid role → fallback to 'user' + log error to Sentry
 * - null/undefined → returns null
 *
 * @param role - The role string to validate
 * @param memberId - Optional Member ID for error logging
 */
export function toUserRole(role: string | null | undefined, memberId?: string): UserRole | null {
  if (role === null || role === undefined) {
    return null;
  }

  const result = userRoleSchema.safeParse(role);
  if (result.success) {
    return result.data;
  }

  logger.error('Invalid user role detected, falling back to user', {
    data: { invalidRole: role, memberId },
    error: new Error(`Invalid user role: ${role} for member: ${memberId ?? 'unknown'}`),
  });

  return 'user';
}
