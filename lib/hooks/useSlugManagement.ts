'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from 'zustand';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { checkArtistSlugAvailable } from '@/lib/queries/artist-browser';
import { checkFormSlugAvailable } from '@/lib/queries/form-browser';
import { checkLabelSlugAvailable } from '@/lib/queries/label-browser';
import { checkPageSlugAvailable, type PageSlugAvailabilityReason } from '@/lib/queries/page-browser';
import { checkPostSlugAvailable } from '@/lib/queries/post-browser';
import { checkReleaseSlugAvailable } from '@/lib/queries/release-browser';
import { checkSeriesSlugAvailable } from '@/lib/queries/series-browser';
import { checkWorkSlugAvailable } from '@/lib/queries/work-browser';
import {
  createSlugManagementStore,
  DEFAULT_SLUG_DEBOUNCE_MS,
  deriveSlugStatus,
  isSettledInput,
  slugDocumentKey,
  writeSlug,
  type SlugAvailabilityCheck,
  type SlugEntityType,
  type SlugManagementPorts,
  type SlugSaveHandler,
} from './slug-management-store';

interface UseSlugManagementOptions {
  /** Entity type for slug availability check */
  entityType: SlugEntityType;
  /** Entity ID (excluded from duplicate check) */
  entityId: string;
  /** Current slug value (from external state - useState or Yjs) */
  slug: string;
  /** Callback when slug should change */
  onSlugChange: (slug: string) => void;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  /** Callback when slug is available and should be saved (for auto-save scenarios) */
  onSave?: SlugSaveHandler;
  /** Optional typed transport for local views; production uses the entity registry. */
  checkAvailability?: SlugAvailabilityCheck;
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
} satisfies Record<SlugEntityType, SlugAvailabilityCheck>;

/** Connects the slug store to the availability query and the editor save queue of the entity. */
export function useSlugManagement({
  entityType,
  entityId,
  slug,
  onSlugChange,
  debounceMs = DEFAULT_SLUG_DEBOUNCE_MS,
  onSave,
  checkAvailability,
}: UseSlugManagementOptions): UseSlugManagementReturn {
  const document = slugDocumentKey(entityType, entityId);
  const activeDocumentRef = useRef(document);
  activeDocumentRef.current = document;
  const onSaveRef = useRef(onSave);
  const checkAction: SlugAvailabilityCheck = checkAvailability ?? checkSlugActions[entityType];

  const slugSave = useDebouncedPatch<{ slug: string }>({
    write: async ({ slug: nextSlug }) => {
      if (activeDocumentRef.current !== document) {
        throw new Error('Slug save belongs to a different entity.');
      }
      await writeSlug(onSaveRef.current, nextSlug);
    },
    delay: 0,
    scope: document,
    document,
    recoveryScope: document,
    recoveryKey: 'slug',
    retry: true,
  });

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const portsRef = useRef<SlugManagementPorts | null>(null);
  const [store] = useState(() =>
    createSlugManagementStore({ entityType, entityId, slug, debounceMs }, () => {
      if (!portsRef.current) {
        throw new Error('The slug field has not mounted.');
      }
      return portsRef.current;
    }),
  );
  useLayoutEffect(() => {
    portsRef.current = {
      onSlugChange,
      hasSaveHandler: () => Boolean(onSaveRef.current),
      enqueueSave: (nextSlug) => slugSave({ slug: nextSlug }),
      flushSave: () => {
        void slugSave.flush();
      },
      checkAvailability: checkAction,
    };
    store.sync({ entityType, entityId, slug, debounceMs });
  });
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  const state = useStore(store.api);
  const debouncedSlug = state.settled.slug;
  const settled = isSettledInput(state, document, slug);
  const { data, isFetching, isError } = useQuery({
    queryKey: ['slug-check', entityType, debouncedSlug, entityId],
    queryFn: () => checkAction(debouncedSlug, entityId),
    enabled: slug.length > 0 && settled,
  });
  const { isChecking, isAvailable, error, errorReason } = deriveSlugStatus(entityType, slug, settled, {
    data,
    isFetching,
    isError,
  });

  useEffect(() => {
    store.considerSave(isAvailable);
  }, [store, isAvailable, settled, debouncedSlug, slug, onSave]);

  const handleBlur = useCallback(() => store.blur({ debouncedSlug, isAvailable }), [store, debouncedSlug, isAvailable]);

  return {
    debouncedSlug,
    isAvailable,
    isChecking,
    error,
    errorReason,
    handleChange: store.handleChange,
    updateFromTitle: store.updateFromTitle,
    handleBlur,
  };
}
