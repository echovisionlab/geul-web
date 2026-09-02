'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { checkArtistSlugAvailable } from '@/lib/queries/artist-browser';
import { checkFormSlugAvailable } from '@/lib/queries/form-browser';
import { checkLabelSlugAvailable } from '@/lib/queries/label-browser';
import {
  checkPageSlugAvailable,
  type PageSlugAvailabilityReason,
  type PageSlugAvailabilityResult,
} from '@/lib/queries/page-browser';
import { checkPostSlugAvailable } from '@/lib/queries/post-browser';
import { checkReleaseSlugAvailable } from '@/lib/queries/release-browser';
import { checkSeriesSlugAvailable } from '@/lib/queries/series-browser';
import { checkWorkSlugAvailable } from '@/lib/queries/work-browser';
import { getPageSlugValidationReason } from '@/lib/utils/page-route';
import { sanitizePageSlugInput, sanitizeSlugInput } from '@/lib/utils/slug';

type EntityType = 'post' | 'page' | 'form' | 'work' | 'label' | 'artist' | 'series' | 'release';

interface UseSlugManagementOptions {
  /** Entity type for slug availability check */
  entityType: EntityType;
  /** Entity ID (excluded from duplicate check) */
  entityId: string;
  /** Current slug value (from external state - useState or Yjs) */
  slug: string;
  /** Callback when slug should change */
  onSlugChange: (slug: string) => void;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Callback when slug is available and should be saved (for auto-save scenarios) */
  onSave?: (slug: string) => void | Promise<unknown>;
}

interface UseSlugManagementReturn {
  /** Debounced slug value */
  debouncedSlug: string;
  /** Slug availability check result */
  isAvailable: boolean | undefined;
  /** Whether availability check is loading */
  isChecking: boolean;
  /** Error message if slug is not available */
  error: string | undefined;
  /** Page-specific machine-readable reason for a rejected availability check */
  errorReason: PageSlugAvailabilityReason | undefined;
  /** Handle slug input change (sanitizes and updates) */
  handleChange: (value: string) => void;
  /** Persist the current slug immediately */
  handleBlur: () => void;
}

const checkSlugActions = {
  artist: checkArtistSlugAvailable,
  post: checkPostSlugAvailable,
  page: checkPageSlugAvailable,
  form: checkFormSlugAvailable,
  work: checkWorkSlugAvailable,
  label: checkLabelSlugAvailable,
  series: checkSeriesSlugAvailable,
  release: checkReleaseSlugAvailable,
};

/**
 * Hook for managing explicit slug edits and validation.
 * Works with both regular state and collaboration state (Yjs).
 */
export function useSlugManagement({
  entityType,
  entityId,
  slug,
  onSlugChange,
  debounceMs = 300,
  onSave,
}: UseSlugManagementOptions): UseSlugManagementReturn {
  const previousEntityId = useRef(entityId);
  const [debouncedSlug] = useDebouncedValue(slug, debounceMs);
  const currentSlugRef = useRef(slug);
  const lastHandledSlug = useRef(debouncedSlug);
  const onSaveRef = useRef(onSave);
  const queuedSaveSlugRef = useRef<string | undefined>(undefined);
  const saveInFlightRef = useRef(false);
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    currentSlugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Reset save tracking when the same hook instance starts editing another entity.
  useEffect(() => {
    if (previousEntityId.current === entityId) {
      return;
    }
    previousEntityId.current = entityId;
    currentSlugRef.current = slug;
    lastHandledSlug.current = slug;
    queuedSaveSlugRef.current = undefined;
    saveInFlightRef.current = false;
    saveGenerationRef.current += 1;
  }, [entityId, slug]);

  const queueSave = useCallback((nextSlug: string) => {
    if (!onSaveRef.current) {
      return;
    }

    // Keep only the newest requested value while a previous save is in flight.
    // Serializing writes prevents a slower, older request from becoming the
    // final server value after the user has continued typing.
    queuedSaveSlugRef.current = nextSlug;
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    const generation = saveGenerationRef.current;

    void (async () => {
      try {
        while (generation === saveGenerationRef.current && queuedSaveSlugRef.current !== undefined) {
          const slugToSave = queuedSaveSlugRef.current;
          queuedSaveSlugRef.current = undefined;

          try {
            await onSaveRef.current?.(slugToSave);
          } catch {
            // Mutation callbacks own user-facing error reporting. Continue with
            // a newer queued value so a failed stale write cannot block it.
          }
        }
      } finally {
        if (generation === saveGenerationRef.current) {
          saveInFlightRef.current = false;
        }
      }
    })();
  }, []);

  const checkAction = checkSlugActions[entityType];
  const isSlugEmpty = debouncedSlug.length === 0;

  const { data, isFetching: isChecking } = useQuery({
    queryKey: ['slug-check', entityType, debouncedSlug, entityId],
    queryFn: () => checkAction(debouncedSlug, entityId),
    enabled: !isSlugEmpty,
  });

  const isAvailable = isSlugEmpty ? true : data?.available;

  const error = entityType !== 'page' && !isSlugEmpty && isAvailable === false ? 'Slug already exists' : undefined;
  const localPageSlugReason = entityType === 'page' ? getPageSlugValidationReason(slug) : undefined;
  const errorReason =
    entityType === 'page' && slug.length > 0
      ? (localPageSlugReason ??
        (!isSlugEmpty && isAvailable === false
          ? ((data as PageSlugAvailabilityResult | undefined)?.reason ?? 'alreadyExists')
          : undefined))
      : undefined;

  // Call onSave when debounced slug changes and is available
  useEffect(() => {
    // Availability belongs to the debounced value. If the user has already
    // typed beyond it, never persist that stale prefix.
    if (currentSlugRef.current !== debouncedSlug) {
      return;
    }

    // Skip if slug hasn't changed
    if (lastHandledSlug.current === debouncedSlug) {
      return;
    }

    // Skip if availability check is still pending
    if (!isSlugEmpty && isAvailable === undefined) {
      return;
    }

    // Only save if slug is available
    if (isAvailable && onSave) {
      queueSave(debouncedSlug);
    }

    // Update ref only after we've processed this slug
    lastHandledSlug.current = debouncedSlug;
  }, [debouncedSlug, isAvailable, isSlugEmpty, onSave, queueSave]);

  const handleChange = useCallback(
    (value: string) => {
      const sanitized = entityType === 'page' ? sanitizePageSlugInput(value) : sanitizeSlugInput(value);
      currentSlugRef.current = sanitized;
      onSlugChange(sanitized);
    },
    [entityType, onSlugChange],
  );

  const handleBlur = useCallback(() => {
    const currentSlug = currentSlugRef.current;

    if (lastHandledSlug.current === currentSlug) {
      return;
    }

    void (async () => {
      const available =
        currentSlug.length === 0
          ? true
          : currentSlug === debouncedSlug && isAvailable !== undefined
            ? isAvailable
            : (await checkAction(currentSlug, entityId)).available;

      // Ignore stale async results if the input changed again while validating.
      if (currentSlugRef.current !== currentSlug) {
        return;
      }

      if (available && onSave) {
        queueSave(currentSlug);
      }

      lastHandledSlug.current = currentSlug;
    })();
  }, [checkAction, debouncedSlug, entityId, isAvailable, onSave, queueSave]);

  return {
    debouncedSlug,
    isAvailable,
    isChecking,
    error,
    errorReason,
    handleChange,
    handleBlur,
  };
}
