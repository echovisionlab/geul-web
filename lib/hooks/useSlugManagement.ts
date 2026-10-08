'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
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
import { generateSlug, sanitizePageSlugInput, sanitizeSlugInput } from '@/lib/utils/slug';

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
  /** Debounce delay in ms (default: 1000) */
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
  /** Follow title edits until the slug has been explicitly set */
  updateFromTitle: (title: string) => void;
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
 * Hook for managing title-generated and explicit slug edits and validation.
 * Works with both regular state and collaboration state (Yjs).
 */
export function useSlugManagement({
  entityType,
  entityId,
  slug,
  onSlugChange,
  debounceMs = 1000,
  onSave,
}: UseSlugManagementOptions): UseSlugManagementReturn {
  const registryEntityType = entityType === 'series' ? 'post_series' : entityType;
  const document = `${registryEntityType}:${entityId}`;
  const previousDocument = useRef(document);
  const activeDocumentRef = useRef(document);
  activeDocumentRef.current = document;
  const saveGenerationRef = useRef(0);
  const debounceInput = useMemo(() => ({ document, slug }), [document, slug]);
  const [debouncedInput] = useDebouncedValue(debounceInput, debounceMs);
  const debouncedSlug = debouncedInput.slug;
  const isCurrentDebouncedSlug = debouncedInput === debounceInput;
  const autoSlugRef = useRef({ enabled: slug.length === 0, lastSlug: slug });
  const currentSlugRef = useRef(slug);
  const lastHandledSlug = useRef(debouncedSlug);
  const onSaveRef = useRef(onSave);

  if (previousDocument.current !== document) {
    previousDocument.current = document;
    saveGenerationRef.current += 1;
    currentSlugRef.current = slug;
    lastHandledSlug.current = slug;
    autoSlugRef.current = { enabled: slug.length === 0, lastSlug: slug };
  } else if (autoSlugRef.current.enabled && slug !== autoSlugRef.current.lastSlug) {
    autoSlugRef.current.enabled = false;
  }

  const slugSave = useDebouncedPatch<{ slug: string }>({
    write: async ({ slug: nextSlug }) => {
      if (activeDocumentRef.current !== document) {
        throw new Error('Slug save belongs to a different entity.');
      }
      const save = onSaveRef.current;
      if (!save) {
        throw new Error('Slug save handler is unavailable.');
      }
      const result = await save(nextSlug);
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Slug save failed.');
      }
    },
    delay: 0,
    scope: document,
    document,
    recoveryScope: document,
    recoveryKey: 'slug',
    retry: true,
  });

  useEffect(() => {
    currentSlugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const queueSave = useCallback(
    (nextSlug: string) => {
      if (!onSaveRef.current) {
        return;
      }
      slugSave({ slug: nextSlug });
    },
    [slugSave],
  );

  const checkAction = checkSlugActions[entityType];
  const isSlugEmpty = slug.length === 0;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['slug-check', entityType, debouncedSlug, entityId],
    queryFn: () => checkAction(debouncedSlug, entityId),
    enabled: !isSlugEmpty && isCurrentDebouncedSlug,
  });

  const isChecking = !isSlugEmpty && (!isCurrentDebouncedSlug || isFetching);
  const isAvailable = isSlugEmpty ? true : isChecking || isError ? undefined : data?.available;

  const error =
    !isSlugEmpty && isError
      ? 'Could not check slug availability'
      : entityType !== 'page' && !isSlugEmpty && isAvailable === false
        ? 'Slug already exists'
        : undefined;
  const localPageSlugReason = entityType === 'page' ? getPageSlugValidationReason(slug) : undefined;
  const errorReason =
    entityType === 'page' && slug.length > 0
      ? (localPageSlugReason ??
        (isError
          ? 'checkFailed'
          : !isSlugEmpty && isAvailable === false
            ? ((data as PageSlugAvailabilityResult | undefined)?.reason ?? 'alreadyExists')
            : undefined))
      : undefined;

  // Call onSave when debounced slug changes and is available
  useEffect(() => {
    // Availability belongs to the debounced value. If the user has already
    // typed beyond it, never persist that stale prefix.
    if (!isCurrentDebouncedSlug || currentSlugRef.current !== debouncedSlug) {
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
  }, [debouncedSlug, isAvailable, isCurrentDebouncedSlug, isSlugEmpty, onSave, queueSave]);

  const handleChange = useCallback(
    (value: string) => {
      autoSlugRef.current.enabled = false;
      const sanitized = entityType === 'page' ? sanitizePageSlugInput(value) : sanitizeSlugInput(value);
      currentSlugRef.current = sanitized;
      onSlugChange(sanitized);
    },
    [entityType, onSlugChange],
  );

  const updateFromTitle = useCallback(
    (title: string) => {
      if (!autoSlugRef.current.enabled) {
        return;
      }
      const generated = generateSlug(title);
      autoSlugRef.current.lastSlug = generated;
      currentSlugRef.current = generated;
      onSlugChange(generated);
    },
    [onSlugChange],
  );

  const handleBlur = useCallback(() => {
    const currentSlug = currentSlugRef.current;
    const documentAtBlur = document;
    const generationAtBlur = saveGenerationRef.current;

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
      if (
        activeDocumentRef.current !== documentAtBlur ||
        saveGenerationRef.current !== generationAtBlur ||
        currentSlugRef.current !== currentSlug
      ) {
        return;
      }

      if (available && onSaveRef.current) {
        queueSave(currentSlug);
        void slugSave.flush();
      }

      lastHandledSlug.current = currentSlug;
    })();
  }, [checkAction, debouncedSlug, document, entityId, isAvailable, queueSave, slugSave]);

  return {
    debouncedSlug,
    isAvailable,
    isChecking,
    error,
    errorReason,
    handleChange,
    updateFromTitle,
    handleBlur,
  };
}
