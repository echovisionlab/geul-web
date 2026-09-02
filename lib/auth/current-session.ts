import type { GeoIPInfo as ApiGeoIPInfo } from '@echovisionlab/geul-proto/secure/common_pb.ts';
import { AccountStatus } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import type { CurrentSessionMember, GetCurrentSessionResponse } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { z } from 'zod';
import { normalizeLocale } from '@/lib/i18n/locale';
import { accountRoleToString, accountStatusToString } from '@/lib/types/user/proto';
import type { GeoInfo, SessionUser, SessionWithUser } from './types';

const accountIdentityIdSchema = z.uuid();
const validRoles = new Set([AuthorizationRole.ADMIN, AuthorizationRole.AUTHOR, AuthorizationRole.USER]);
const validStatuses = new Set([
  AccountStatus.ACTIVE,
  AccountStatus.BANNED,
  AccountStatus.PENDING_DELETION,
  AccountStatus.DELETED,
]);

function geoInfoFromApiGeo(geo: ApiGeoIPInfo | undefined): GeoInfo | null {
  if (!geo) {
    return null;
  }
  return {
    countryCode: geo.countryCode,
    countryName: geo.countryName,
    city: geo.city ?? null,
    latitude: geo.latitude,
    longitude: geo.longitude,
    isProxy: geo.isProxy,
    isSatellite: geo.isSatellite,
    timeZone: geo.timeZone ?? null,
  };
}

function parseSessionUser(member: CurrentSessionMember | undefined): SessionUser | null {
  if (!member) {
    return null;
  }
  const summary = member.summary;
  const nickname = summary?.nickname.trim() ?? '';
  if (!summary?.id || !nickname || !validRoles.has(member.role) || !validStatuses.has(member.status)) {
    return null;
  }
  return {
    id: summary.id,
    nickname,
    email: member.email ?? null,
    image: summary.avatarAsset?.url ?? null,
    preferred_locale: normalizeLocale(member.preferredLocale) ?? null,
    role: accountRoleToString(member.role),
    status: accountStatusToString(member.status),
  };
}

export function parseCurrentSession(response: GetCurrentSessionResponse): SessionWithUser | null {
  const user = parseSessionUser(response.member);
  const accountIdentityId = accountIdentityIdSchema.safeParse(response.accountIdentityId);
  if (!user || !accountIdentityId.success) {
    return null;
  }
  return {
    account_identity_id: accountIdentityId.data,
    user,
    geo: geoInfoFromApiGeo(response.metadata?.geo),
    onboarded: response.onboarded,
    nickname_suggestion: response.onboarded ? null : response.nicknameSuggestion?.trim() || null,
  };
}
