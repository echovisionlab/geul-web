import { PageLoader } from '@/features/site/PageLoader';

interface QueryLoadingSurfaceProps {
  queries: readonly { isLoading: boolean }[];
}

export function QueryLoadingSurface({ queries }: QueryLoadingSurfaceProps) {
  return queries.some((query) => query.isLoading) ? <PageLoader placement="flow" minHeight={80} size="xs" /> : null;
}
