import type { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/providers/ReactQueryProvider';

// This route renders React Query clients on its first paint; the provider is not in the root layout,
// so public routes without React Query do not load it (`route-package-reach.mjs`, `query-provider-placement.test.ts`).
export default function QueryRouteLayout({ children }: { children: ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
