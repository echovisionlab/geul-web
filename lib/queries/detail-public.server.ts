import { cache } from 'react';
import {
  createPublicArtistClientWithAuth,
  createPublicLabelClientWithAuth,
  createPublicReleaseClientWithAuth,
  createPublicSeriesClientWithAuth,
  createPublicProgramEventClientWithAuth,
  createPublicProgramEventSeriesClientWithAuth,
} from '@/lib/api/server-client';

// Ordinary reads share raw responses only for this React request. Token and
// password reads remain with their guarded callers and never enter this cache.

const getPublicArtistResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicArtistClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicArtistResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicArtistResponseCached(decodedSlug, requestedLocale?.trim() || null);
}

const getPublicLabelResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicLabelClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicLabelResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicLabelResponseCached(decodedSlug, requestedLocale?.trim() || null);
}

const getPublicReleaseResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicReleaseClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicReleaseResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicReleaseResponseCached(decodedSlug, requestedLocale?.trim() || null);
}

const getPublicSeriesResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicSeriesClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicSeriesResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicSeriesResponseCached(decodedSlug, requestedLocale?.trim() || null);
}

const getPublicProgramEventResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicProgramEventClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicProgramEventResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicProgramEventResponseCached(decodedSlug, requestedLocale?.trim() || null);
}

const getPublicProgramEventSeriesResponseCached = cache(async (decodedSlug: string, requestedLocale: string | null) => {
  const client = await createPublicProgramEventSeriesClientWithAuth(requestedLocale);
  return client.get({ slug: decodedSlug });
});

export function getPublicProgramEventSeriesResponse(decodedSlug: string, requestedLocale?: string | null) {
  return getPublicProgramEventSeriesResponseCached(decodedSlug, requestedLocale?.trim() || null);
}
