import type { SocialLinks } from '../common/social-links';
import type { output } from 'zod';
import { userRoleSchema } from './schema';
export { userFilterFields, userSortFields } from './table-spec';

export type UserRole = output<typeof userRoleSchema>;

export interface UserBasic {
  id: string;
  nickname: string;
  image: string | null;
  role: string | null;
  created_at: Date;
}

export interface UserListItem {
  id: string;
  nickname: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  onboarded: boolean;
  newsletter_subscribed: boolean;
  newsletter_subscribed_at: Date | null;
  created_at: Date;
}

export type AdminUserAuthEmailSourceType = 'kratos_current' | 'email_code' | 'oidc_provider' | 'unknown';

export interface AdminUserAuthProvider {
  provider: string;
  identifier: string;
}

export interface AdminUserAuthEmailSource {
  source_type: AdminUserAuthEmailSourceType;
  provider: string | null;
  provider_subject: string | null;
}

export interface AdminUserAuthEmailCandidate {
  email: string;
  normalized_email: string;
  current: boolean;
  kratos_verified: boolean;
  effective_trusted: boolean;
  usable_for_delivery: boolean;
  sources: AdminUserAuthEmailSource[];
}

export interface AdminUserAuthDetails {
  providers: AdminUserAuthProvider[];
  email_candidates: AdminUserAuthEmailCandidate[];
}

export interface AdminUserBanDetails {
  metadata_banned: boolean;
  identity_state: string;
  inactive_state: boolean;
  reason: string | null;
  expires_at: Date | null;
}

export interface UserFull {
  id: string;
  tag_ids: string[];
  nickname: string;
  email: string | null;
  email_verified: boolean;
  image: string | null;
  bio: string | null;
  website: string | null;
  social_links: SocialLinks;
  role: string | null;
  banned: boolean | null;
  onboarded: boolean;
  ban_reason: string | null;
  ban_expires: Date | null;
  status: string | null;
  auth_details: AdminUserAuthDetails | null;
  ban_details: AdminUserBanDetails | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface UserPublishedPost {
  id: string;
  title: string;
  summary: string | null;
  published_at: Date | null;
  created_at: Date;
}

export interface UpdateUserInput {
  nickname?: string;
  image?: string | null;
  bio?: string | null;
  website?: string | null;
  social_links?: SocialLinks | null;
  role?: string | null;
  banned?: boolean | null;
  ban_reason?: string | null;
  ban_expires?: Date | null;
  updated_at?: Date;
}

// =============================================================================
// Session Info (for session list)
// =============================================================================

/**
 * Kratos session info for display in the security page.
 */
export interface SessionInfo {
  id: string;
  active: boolean;
  current?: boolean;
  authenticated_at: string;
  devices?: Array<{
    ip_address?: string;
    user_agent?: string;
  }>;
}
