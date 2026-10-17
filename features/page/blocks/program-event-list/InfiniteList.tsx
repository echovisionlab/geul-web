'use client';

import { useCallback } from 'react';
import { InfiniteItems } from '../infinite-items';
import type { ProgramEventListProps } from './schema';
import { ProgramEventListViewClient } from './ViewClient';
import type { ProgramEventListViewClientProps } from './ViewClientRuntime';

type Item = ProgramEventListViewClientProps['events'][number];
type BrowserQuery = Omit<
  Parameters<typeof import('@/lib/queries/program-event-browser').listProgramEventsForBlockBrowser>[0],
  'offset' | 'requestedLocale'
>;

/** Server-rendered first page; further pages load on the client through the public query, on demand. */
export function ProgramEventInfiniteList({
  initialEvents,
  total,
  query,
  parsedProps,
  locale,
}: {
  initialEvents: Item[];
  total: number;
  query: BrowserQuery;
  parsedProps: ProgramEventListProps;
  locale?: string;
}) {
  const loadPage = useCallback(
    async (offset: number) => {
      const { listProgramEventsForBlockBrowser } = await import('@/lib/queries/program-event-browser');
      const { events } = await listProgramEventsForBlockBrowser({ ...query, offset, requestedLocale: locale });
      return events;
    },
    [query, locale],
  );
  return (
    <InfiniteItems initialItems={initialEvents} total={total} loadPage={loadPage}>
      {(events) => <ProgramEventListViewClient events={[...events]} parsedProps={parsedProps} locale={locale} />}
    </InfiniteItems>
  );
}
