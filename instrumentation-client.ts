import { dispatchRouteProgressStart } from '@/lib/navigation/route-progress-events';

export function onRouterTransitionStart(url: string, _navigationType: 'push' | 'replace' | 'traverse') {
  dispatchRouteProgressStart(url);
}
