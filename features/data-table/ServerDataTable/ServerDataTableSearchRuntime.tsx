'use client';

/**
 * Server DataTable Search - Client Component for debounced search.
 *
 * This is a "Client Island" within the Server DataTable.
 * It handles debounced search input and updates the URL via router.push.
 */

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  useServerTablePathname as usePathname,
  useServerTableRouter as useRouter,
  useServerTableSearchParams as useSearchParams,
  useServerTablePending,
} from './ServerDataTableNavigation';
import { useTranslations } from 'next-intl';

import { useDebouncedValue } from '@mantine/hooks';
import { SearchInput } from '@/components/core/Input/SearchInput';
import { buildSearchUrl, parseTableQuery } from '@/lib/utils/table-url';

export interface ServerDataTableSearchProps {
  /** Unique namespace for URL params (e.g., 'artists', 'posts') */
  namespace: string;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
}

export function ServerDataTableSearch({ namespace, placeholder, debounceMs = 300 }: ServerDataTableSearchProps) {
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse current search value from URL
  const currentQuery = parseTableQuery(searchParams, namespace);
  const [search, setSearch] = useState(currentQuery.search ?? '');
  const [debouncedSearch] = useDebouncedValue(search, debounceMs);

  // Track the last value we pushed to URL to avoid duplicate pushes
  // Normalize to empty string for consistent comparison
  const lastPushedRef = useRef(currentQuery.search ?? '');
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync with URL when it changes externally (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = parseTableQuery(searchParams, namespace).search ?? '';
    if (urlSearch !== lastPushedRef.current) {
      setSearch(urlSearch);
      lastPushedRef.current = urlSearch;
    }
  }, [searchParams, namespace]);

  // Push debounced search to URL
  useEffect(() => {
    // Normalize to empty string for consistent comparison
    const normalizedDebounced = debouncedSearch ?? '';

    // Only push if the value differs from what's in the URL
    if (normalizedDebounced !== lastPushedRef.current) {
      lastPushedRef.current = normalizedDebounced;

      const url = buildSearchUrl(namespace, searchParams, normalizedDebounced || undefined, pathname);

      startTransition(async () => {
        await router.push(url, { scroll: false });
      });
    }
  }, [debouncedSearch, namespace, searchParams, pathname, router]);

  // Ref to restore focus after navigation
  const inputRef = useRef<HTMLInputElement>(null);
  const hadFocusRef = useRef(false);
  const effectivePlaceholder = placeholder ?? tCommonPlaceholders('search');

  // Track if input had focus before transition
  const handleFocus = () => {
    hadFocusRef.current = true;
  };
  const handleBlur = () => {
    hadFocusRef.current = false;
  };

  // Restore focus after transition completes
  useEffect(() => {
    if (!isPending && hadFocusRef.current && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPending]);

  useServerTablePending(rootRef, isPending);

  return (
    <DsLayoutStack flexible ref={rootRef} gap="none">
      <SearchInput
        ref={inputRef}
        placeholder={effectivePlaceholder}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={effectivePlaceholder}
      />
    </DsLayoutStack>
  );
}
