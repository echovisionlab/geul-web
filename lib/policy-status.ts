export const TERMS_STATUS = {
  DRAFT: 'TERMS_STATUS_DRAFT',
  SCHEDULED: 'TERMS_STATUS_SCHEDULED',
  ACTIVE: 'TERMS_STATUS_ACTIVE',
  ARCHIVED: 'TERMS_STATUS_ARCHIVED',
} as const;

export type TermsStatus = (typeof TERMS_STATUS)[keyof typeof TERMS_STATUS];

export const PRIVACY_STATUS = {
  DRAFT: 'PRIVACY_STATUS_DRAFT',
  SCHEDULED: 'PRIVACY_STATUS_SCHEDULED',
  ACTIVE: 'PRIVACY_STATUS_ACTIVE',
  ARCHIVED: 'PRIVACY_STATUS_ARCHIVED',
} as const;

export type PrivacyStatus = (typeof PRIVACY_STATUS)[keyof typeof PRIVACY_STATUS];

const TERMS_STATUS_VALUES = new Set(Object.values(TERMS_STATUS));
const PRIVACY_STATUS_VALUES = new Set(Object.values(PRIVACY_STATUS));

const TERMS_STATUS_COLORS: Record<TermsStatus, string> = {
  [TERMS_STATUS.DRAFT]: 'gray',
  [TERMS_STATUS.SCHEDULED]: 'blue',
  [TERMS_STATUS.ACTIVE]: 'green',
  [TERMS_STATUS.ARCHIVED]: 'gray',
};

const PRIVACY_STATUS_COLORS: Record<PrivacyStatus, string> = {
  [PRIVACY_STATUS.DRAFT]: 'gray',
  [PRIVACY_STATUS.SCHEDULED]: 'blue',
  [PRIVACY_STATUS.ACTIVE]: 'green',
  [PRIVACY_STATUS.ARCHIVED]: 'gray',
};

export function isTermsDraft(status?: string | null): status is typeof TERMS_STATUS.DRAFT {
  return status === TERMS_STATUS.DRAFT;
}

export function isTermsScheduled(status?: string | null): status is typeof TERMS_STATUS.SCHEDULED {
  return status === TERMS_STATUS.SCHEDULED;
}

export function isTermsActive(status?: string | null): status is typeof TERMS_STATUS.ACTIVE {
  return status === TERMS_STATUS.ACTIVE;
}

export function isTermsArchived(status?: string | null): status is typeof TERMS_STATUS.ARCHIVED {
  return status === TERMS_STATUS.ARCHIVED;
}

export function isTermsEditable(status?: string | null): boolean {
  return isTermsDraft(status) || isTermsScheduled(status) || isTermsActive(status);
}

export function toTermsStatus(status?: string | null): TermsStatus {
  if (status && TERMS_STATUS_VALUES.has(status as TermsStatus)) {
    return status as TermsStatus;
  }
  return TERMS_STATUS.DRAFT;
}

export function getTermsStatusColor(status?: string | null): string {
  if (!status) {
    return TERMS_STATUS_COLORS[TERMS_STATUS.DRAFT];
  }
  return TERMS_STATUS_COLORS[status as TermsStatus] ?? 'gray';
}

export function isPrivacyDraft(status?: string | null): status is typeof PRIVACY_STATUS.DRAFT {
  return status === PRIVACY_STATUS.DRAFT;
}

export function isPrivacyScheduled(status?: string | null): status is typeof PRIVACY_STATUS.SCHEDULED {
  return status === PRIVACY_STATUS.SCHEDULED;
}

export function isPrivacyActive(status?: string | null): status is typeof PRIVACY_STATUS.ACTIVE {
  return status === PRIVACY_STATUS.ACTIVE;
}

export function isPrivacyArchived(status?: string | null): status is typeof PRIVACY_STATUS.ARCHIVED {
  return status === PRIVACY_STATUS.ARCHIVED;
}

export function isPrivacyEditable(status?: string | null): boolean {
  return isPrivacyDraft(status) || isPrivacyScheduled(status) || isPrivacyActive(status);
}

export function toPrivacyStatus(status?: string | null): PrivacyStatus {
  if (status && PRIVACY_STATUS_VALUES.has(status as PrivacyStatus)) {
    return status as PrivacyStatus;
  }
  return PRIVACY_STATUS.DRAFT;
}

export function getPrivacyStatusColor(status?: string | null): string {
  if (!status) {
    return PRIVACY_STATUS_COLORS[PRIVACY_STATUS.DRAFT];
  }
  return PRIVACY_STATUS_COLORS[status as PrivacyStatus] ?? 'gray';
}
