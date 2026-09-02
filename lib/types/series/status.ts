import type { SeriesStatus } from './model';

const API_DRAFT = 'SERIES_STATUS_DRAFT';
const API_PUBLISHED = 'SERIES_STATUS_PUBLISHED';

export function fromApiSeriesStatus(status: string | null | undefined): SeriesStatus {
  if (!status) {
    return 'draft';
  }

  if (status === API_DRAFT || status.toLowerCase() === 'draft') {
    return 'draft';
  }
  if (status === API_PUBLISHED || status.toLowerCase() === 'published') {
    return 'published';
  }

  return 'draft';
}

export function toApiSeriesStatus(status: SeriesStatus | null | undefined): string | undefined {
  if (!status) {
    return undefined;
  }

  if (status === 'draft') {
    return API_DRAFT;
  }
  if (status === 'published') {
    return API_PUBLISHED;
  }

  return undefined;
}
