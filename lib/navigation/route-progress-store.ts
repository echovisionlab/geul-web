export type RouteProgressPhase = 'idle' | 'waiting' | 'loading' | 'completing';

export interface RouteProgressSnapshot {
  phase: RouteProgressPhase;
}

export interface RouteProgressStore {
  complete: () => void;
  getSnapshot: () => RouteProgressSnapshot;
  reset: () => void;
  start: (targetUrl: string, currentUrl: string) => boolean;
  subscribe: (listener: () => void) => () => void;
}

export const ROUTE_PROGRESS_REVEAL_DELAY_MS = 120;
export const ROUTE_PROGRESS_COMPLETION_MS = 180;
export const ROUTE_PROGRESS_SAFETY_TIMEOUT_MS = 30_000;

const IDLE_SNAPSHOT: RouteProgressSnapshot = Object.freeze({ phase: 'idle' });

function shouldTrackRouteTransition(targetUrl: string, currentUrl: string): boolean {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl, current);

    return (
      target.origin === current.origin && (target.pathname !== current.pathname || target.search !== current.search)
    );
  } catch {
    return false;
  }
}

export function createRouteProgressStore(): RouteProgressStore {
  let snapshot = IDLE_SNAPSHOT;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let completionTimer: ReturnType<typeof setTimeout> | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const publish = (phase: RouteProgressPhase) => {
    if (snapshot.phase === phase) {
      return;
    }

    snapshot = phase === 'idle' ? IDLE_SNAPSHOT : { phase };
    listeners.forEach((listener) => listener());
  };

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  };

  const clearTimers = () => {
    clearTimer(revealTimer);
    clearTimer(completionTimer);
    clearTimer(safetyTimer);
    revealTimer = null;
    completionTimer = null;
    safetyTimer = null;
  };

  const reset = () => {
    clearTimers();
    publish('idle');
  };

  const complete = () => {
    clearTimer(revealTimer);
    clearTimer(safetyTimer);
    revealTimer = null;
    safetyTimer = null;

    if (snapshot.phase === 'idle') {
      return;
    }

    if (snapshot.phase === 'waiting') {
      publish('idle');
      return;
    }

    publish('completing');
    clearTimer(completionTimer);
    completionTimer = setTimeout(() => {
      completionTimer = null;
      publish('idle');
    }, ROUTE_PROGRESS_COMPLETION_MS);
  };

  const start = (targetUrl: string, currentUrl: string) => {
    if (!shouldTrackRouteTransition(targetUrl, currentUrl)) {
      return false;
    }

    const alreadyVisible = snapshot.phase === 'loading' || snapshot.phase === 'completing';
    clearTimers();
    publish(alreadyVisible ? 'loading' : 'waiting');

    if (!alreadyVisible) {
      revealTimer = setTimeout(() => {
        revealTimer = null;
        publish('loading');
      }, ROUTE_PROGRESS_REVEAL_DELAY_MS);
    }

    safetyTimer = setTimeout(complete, ROUTE_PROGRESS_SAFETY_TIMEOUT_MS);
    return true;
  };

  return {
    complete,
    getSnapshot: () => snapshot,
    reset,
    start,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const routeProgressStore = createRouteProgressStore();
export const routeProgressServerSnapshot = IDLE_SNAPSHOT;
