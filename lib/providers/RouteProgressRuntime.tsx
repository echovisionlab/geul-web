'use client';

import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RouteProgressBar } from '@/components/core/Progress/RouteProgressBar';
import { ROUTE_PROGRESS_START_EVENT, type RouteProgressStartEventDetail } from '@/lib/navigation/route-progress-events';
import { routeProgressServerSnapshot, routeProgressStore } from '@/lib/navigation/route-progress-store';

function RouteProgressStartObserver() {
  useEffect(() => {
    const handleStart = (event: Event) => {
      const { url } = (event as CustomEvent<RouteProgressStartEventDetail>).detail;
      routeProgressStore.start(url, window.location.href);
    };

    window.addEventListener(ROUTE_PROGRESS_START_EVENT, handleStart);
    return () => window.removeEventListener(ROUTE_PROGRESS_START_EVENT, handleStart);
  }, []);

  return null;
}

function RouteProgressCommitObserver() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const renderedSearch = searchParams.toString();

  useEffect(() => {
    routeProgressStore.complete();
  }, [pathname, renderedSearch]);

  return null;
}

export function RouteProgressRuntime() {
  const t = useTranslations('common.states');
  const snapshot = useSyncExternalStore(
    routeProgressStore.subscribe,
    routeProgressStore.getSnapshot,
    () => routeProgressServerSnapshot,
  );

  return (
    <>
      <RouteProgressBar phase={snapshot.phase} aria-label={t('loading')} />
      <RouteProgressStartObserver />
      <Suspense fallback={null}>
        <RouteProgressCommitObserver />
      </Suspense>
    </>
  );
}
