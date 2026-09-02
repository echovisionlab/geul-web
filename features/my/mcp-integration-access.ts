import type { UserRole } from '@/lib/types/user/model';
import type { PersonalAccessTokenSummary } from '@/lib/actions/personal-access-token';

export interface PersonalAccessTokenSettingsItem extends PersonalAccessTokenSummary {
  canRegenerate: boolean;
}

export function canAccessMcpIntegrationSettings(role: UserRole | undefined): boolean {
  return role === 'author' || role === 'admin';
}

export function projectPersonalAccessTokensForSettings(
  tokens: PersonalAccessTokenSummary[],
): PersonalAccessTokenSettingsItem[] {
  return tokens.map((token) => ({ ...token, canRegenerate: true }));
}
