export const ROUTE_PROGRESS_START_EVENT = 'geul:route-progress-start';

export interface RouteProgressStartEventDetail {
  url: string;
}

export function dispatchRouteProgressStart(url: string) {
  window.dispatchEvent(
    new CustomEvent<RouteProgressStartEventDetail>(ROUTE_PROGRESS_START_EVENT, {
      detail: { url },
    }),
  );
}
