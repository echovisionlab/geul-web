import type { SocialLinks } from '@/lib/types/common/social-links';
import type { AdminUserProfileFormValues } from './UserProfileFormSection';

/** The profile values last loaded from or saved to the server; the form and side fields are compared to it. */
export interface AdminUserProfileSnapshot {
  nickname: string;
  bio: string;
  role: string;
  tagIds: string[];
  website: string;
  socialLinks: SocialLinks;
}

export interface AdminUserProfileChanges {
  id: string;
  nickname?: string;
  bio?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  role?: string;
  tagIds?: string[];
}

function sameStringRecord(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => {
      return key === rightKeys[index] && left[key] === right[key];
    })
  );
}

function sameTagIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

/**
 * Builds the update for only the fields the Admin changed: dirty form fields, tags that differ from the
 * baseline as a set, and website/social links that differ from the baseline. Cleared bio and website are
 * sent as null. Returns null when nothing changed, so no update is issued.
 */
export function buildAdminUserProfileChanges({
  id,
  values,
  isDirty,
  baseline,
  website,
  socialLinks,
}: {
  id: string;
  values: AdminUserProfileFormValues;
  isDirty: (path: keyof AdminUserProfileFormValues) => boolean;
  baseline: AdminUserProfileSnapshot;
  website: string;
  socialLinks: SocialLinks;
}): AdminUserProfileChanges | null {
  const changes: AdminUserProfileChanges = { id };
  if (isDirty('nickname')) {
    changes.nickname = values.nickname;
  }
  if (isDirty('bio')) {
    changes.bio = values.bio || null;
  }
  if (isDirty('role')) {
    changes.role = values.role;
  }
  if (isDirty('tagIds') && !sameTagIds(values.tagIds, baseline.tagIds)) {
    changes.tagIds = values.tagIds;
  }
  if (website !== baseline.website) {
    changes.website = website || null;
  }
  if (!sameStringRecord(socialLinks, baseline.socialLinks)) {
    changes.socialLinks = socialLinks;
  }
  return Object.keys(changes).length > 1 ? changes : null;
}

/**
 * Whether a server snapshot of the Member may replace the form. It may not while a save is pending, when it
 * is the snapshot that was current when the last save succeeded (the refetch has not arrived yet), or when
 * the Admin has unsaved edits in the form, website or social links.
 */
export function shouldAdoptServerProfile<User extends object>({
  user,
  isSaving,
  savedSnapshot,
  baseline,
  isFormDirty,
  website,
  socialLinks,
}: {
  user: User | undefined;
  isSaving: boolean;
  savedSnapshot: User | null | undefined;
  baseline: AdminUserProfileSnapshot | null;
  isFormDirty: boolean;
  website: string;
  socialLinks: SocialLinks;
}): boolean {
  if (!user || isSaving || savedSnapshot === user) {
    return false;
  }
  return !(
    baseline &&
    (isFormDirty || website !== baseline.website || !sameStringRecord(socialLinks, baseline.socialLinks))
  );
}
