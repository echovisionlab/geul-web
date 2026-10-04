import type { PublicLegalPageData } from './legal-public-page';

export interface PublicLegalHistoryItem {
  id: string;
  version: number;
  effectiveFrom: Date | null;
  effectiveUntil?: Date | null;
}

export interface PublicLegalHistoryInitialData {
  requestedLocale: string;
  updatedAt: number;
  active: PublicLegalHistoryItem | null;
  archived: PublicLegalHistoryItem[];
}

export type PublicLegalHistoryDetail = Omit<NonNullable<PublicLegalPageData['active']>, 'status'> & {
  status: 'active' | 'archived';
  effectiveUntil: Date | null;
};

export interface PublicLegalHistoryDetailInitialData {
  id: string;
  requestedLocale: string;
  updatedAt: number;
  data: PublicLegalHistoryDetail | null;
}
