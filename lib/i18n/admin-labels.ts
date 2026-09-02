export function normalizeEnumToken(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+_status_/, '')
    .replace(/^[a-z]+_role_/, '')
    .replace(/-/g, '_');
}

type CommonStatusMessageKey =
  | 'statuses.draft'
  | 'statuses.published'
  | 'statuses.archived'
  | 'statuses.scheduled'
  | 'statuses.active'
  | 'statuses.inactive'
  | 'statuses.sent'
  | 'statuses.banned'
  | 'statuses.pendingDeletion'
  | 'statuses.deleted'
  | 'statuses.pending'
  | 'statuses.verified'
  | 'statuses.unsubscribed';

type CommonRoleMessageKey = 'roles.admin' | 'roles.author' | 'roles.user';

export function translateCommonStatus(
  value: string | null | undefined,
  tCommon: (key: CommonStatusMessageKey) => string,
): string {
  switch (normalizeEnumToken(value)) {
    case 'draft':
      return tCommon('statuses.draft');
    case 'published':
      return tCommon('statuses.published');
    case 'archived':
      return tCommon('statuses.archived');
    case 'scheduled':
      return tCommon('statuses.scheduled');
    case 'active':
      return tCommon('statuses.active');
    case 'inactive':
      return tCommon('statuses.inactive');
    case 'sent':
      return tCommon('statuses.sent');
    case 'banned':
      return tCommon('statuses.banned');
    case 'pending_deletion':
      return tCommon('statuses.pendingDeletion');
    case 'deleted':
      return tCommon('statuses.deleted');
    case 'pending':
      return tCommon('statuses.pending');
    case 'verified':
      return tCommon('statuses.verified');
    case 'unsubscribed':
      return tCommon('statuses.unsubscribed');
    default:
      return value ?? '';
  }
}

export function translateCommonRole(
  value: string | null | undefined,
  tCommon: (key: CommonRoleMessageKey) => string,
): string {
  switch (normalizeEnumToken(value)) {
    case 'admin':
      return tCommon('roles.admin');
    case 'author':
      return tCommon('roles.author');
    case 'user':
      return tCommon('roles.user');
    default:
      return value ?? '';
  }
}
