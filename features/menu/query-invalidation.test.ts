// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@/test/render';
import {
  TranslationServicesProvider,
  type TranslationServices,
} from '@/features/translation/TranslationServicesContext';
import { useEntityTranslationData } from '@/features/translation/useEntityTranslationData';
import { invalidateMenuEditorQueries } from './query-invalidation';

type Request = { target?: { entityId: string }; filters?: Array<{ field: string; value: string }> };

// The translation service is the only boundary replaced; it counts requests per menu so a refetch is observable
// through the real translation data hook and its own query keys.
function createTranslationServices() {
  const requests = { entries: new Map<string, number>(), jobs: new Map<string, number>() };
  const count = (counter: Map<string, number>, id = '') => counter.set(id, (counter.get(id) ?? 0) + 1);
  const client = {
    listTranslationLocales: async () => ({ locales: [] }),
    listEntityTranslations: async (request: Request) => {
      count(requests.entries, request.target?.entityId);
      return { translations: [] };
    },
    listTranslationJobs: async (request: Request) => {
      count(requests.jobs, request.filters?.find((filter) => filter.field === 'entity_id')?.value);
      return { jobs: [] };
    },
  };
  const services = { client, mutateTarget: async () => undefined } as unknown as TranslationServices;
  return { services, requests };
}

async function mountMenuTranslations(queryClient: QueryClient) {
  const { services, requests } = createTranslationServices();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        TranslationServicesProvider as (props: { services: TranslationServices; children?: ReactNode }) => ReactNode,
        { services },
        children,
      ),
    );
  for (const entityId of ['menu-1', 'menu-2']) {
    const { result } = renderHook(() => useEntityTranslationData({ entityType: 'menu', entityId }), { wrapper });
    await waitFor(() => expect(result.current.entriesQuery.isSuccess && result.current.jobsQuery.isSuccess).toBe(true));
  }
  const loads = (id: string) => ({ entries: requests.entries.get(id), jobs: requests.jobs.get(id) });
  return { loads };
}

function seedMenus(queryClient: QueryClient) {
  queryClient.setQueryData(['menus', 'list'], [{ id: 'menu-1' }, { id: 'menu-2' }]);
  queryClient.setQueryData(['menus', 'detail', 'menu-1'], { id: 'menu-1' });
}

describe('invalidateMenuEditorQueries', () => {
  it("refetches the menu list and that menu's translations and translation jobs after a menu mutation", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seedMenus(queryClient);
    const { loads } = await mountMenuTranslations(queryClient);

    await invalidateMenuEditorQueries(queryClient, 'menu-1');

    expect(queryClient.getQueryState(['menus', 'list'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['menus', 'detail', 'menu-1'])?.isInvalidated).toBe(true);
    expect(loads('menu-1')).toEqual({ entries: 2, jobs: 2 });
    expect(loads('menu-2')).toEqual({ entries: 1, jobs: 1 });
  });

  it('refreshes only the menu queries when no menu is selected', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seedMenus(queryClient);
    const { loads } = await mountMenuTranslations(queryClient);

    await invalidateMenuEditorQueries(queryClient, null);

    expect(queryClient.getQueryState(['menus', 'list'])?.isInvalidated).toBe(true);
    expect(loads('menu-1')).toEqual({ entries: 1, jobs: 1 });
    expect(loads('menu-2')).toEqual({ entries: 1, jobs: 1 });
  });
});
