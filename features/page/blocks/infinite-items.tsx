'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { LayoutInline, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { SupportingText, VisuallyHidden } from '@/components/core/Typography';

type LoadStatus = 'idle' | 'loading' | 'failed';

/**
 * Appends pages to a server-rendered first page. `loadPage(offset)` receives the number of items the
 * server has returned so far (not the number shown): items whose id is already present are dropped so a
 * shifted list never repeats one, without stalling the offset. Remount (via `key`) when the query changes.
 */
export function useInfiniteItems<T extends { id: string }>(
  initialItems: readonly T[],
  total: number,
  loadPage: (offset: number) => Promise<readonly T[]>,
) {
  const [items, setItems] = useState<readonly T[]>(initialItems);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [exhausted, setExhausted] = useState(false);
  const [offset, setOffset] = useState(initialItems.length);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const hasMore = !exhausted && offset < total;

  const loadMore = useCallback(async () => {
    if (pending.current || !hasMore) {
      return;
    }
    pending.current = true;
    setStatus('loading');
    try {
      const next = await loadPage(offset);
      if (!active.current) {
        return;
      }
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.filter((item) => !seen.has(item.id))];
      });
      setOffset((current) => current + next.length);
      // An empty page means the total moved underneath us: stop instead of asking again.
      setExhausted(next.length === 0);
      setStatus('idle');
    } catch {
      if (active.current) {
        setStatus('failed');
      }
    } finally {
      pending.current = false;
    }
  }, [hasMore, offset, loadPage]);

  return { items, hasMore, status, loadMore };
}

export interface InfiniteLoadMoreProps {
  hasMore: boolean;
  status: LoadStatus;
  onLoadMore: () => unknown;
}

/**
 * The end of an infinitely scrolling collection: nearing it loads the next page; the button is the
 * same action for keyboard, assistive technology and reduced-motion users, and the retry after a failure.
 * Automatic loading pauses after a failure until the reader retries.
 */
export function InfiniteLoadMore({ hasMore, status, onLoadMore }: InfiniteLoadMoreProps) {
  const t = useTranslations('common.loadMore');
  const sentinel = useRef<HTMLDivElement>(null);
  const autoLoad = hasMore && status === 'idle';

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !autoLoad || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void onLoadMore();
        }
      },
      { rootMargin: '0px 0px 600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoad, onLoadMore]);

  if (!hasMore) {
    return null;
  }
  return (
    <LayoutInset blockStart="lg">
      <div ref={sentinel} aria-hidden="true" />
      <LayoutStack gap="xs" align="center">
        {status === 'failed' ? (
          <SupportingText role="alert" tone="secondary" align="center">
            {t('failed')}
          </SupportingText>
        ) : null}
        <LayoutInline justify="center">
          <Button emphasis="medium" loading={status === 'loading'} onClick={() => void onLoadMore()}>
            {status === 'failed' ? t('retry') : t('action')}
          </Button>
        </LayoutInline>
        <VisuallyHidden role="status">{status === 'loading' ? t('loading') : ''}</VisuallyHidden>
      </LayoutStack>
    </LayoutInset>
  );
}

export function InfiniteItems<T extends { id: string }>({
  initialItems,
  total,
  loadPage,
  children,
}: {
  initialItems: readonly T[];
  total: number;
  loadPage: (offset: number) => Promise<readonly T[]>;
  children: (items: readonly T[]) => ReactNode;
}) {
  const { items, hasMore, status, loadMore } = useInfiniteItems(initialItems, total, loadPage);
  return (
    <>
      {children(items)}
      <InfiniteLoadMore hasMore={hasMore} status={status} onLoadMore={loadMore} />
    </>
  );
}
