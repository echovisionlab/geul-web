// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchRouteProgressStart,
  ROUTE_PROGRESS_START_EVENT,
  type RouteProgressStartEventDetail,
} from './route-progress-events';

describe('route progress events', () => {
  afterEach(() => vi.restoreAllMocks());

  it('dispatches the destination without changing browser history', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    let detail: RouteProgressStartEventDetail | undefined;
    const listener = (event: Event) => {
      detail = (event as CustomEvent<RouteProgressStartEventDetail>).detail;
    };
    window.addEventListener(ROUTE_PROGRESS_START_EVENT, listener);

    dispatchRouteProgressStart('/posts?lang=ko');

    expect(detail).toEqual({ url: '/posts?lang=ko' });
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    window.removeEventListener(ROUTE_PROGRESS_START_EVENT, listener);
  });
});
