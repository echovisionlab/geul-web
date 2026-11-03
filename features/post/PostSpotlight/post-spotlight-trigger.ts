import { onDemandModule } from '@/components/core/on-demand-module';

/** Invoke general-layout search without importing its modal renderer. */
export const POST_SPOTLIGHT_OPEN_EVENT = 'geul:open-post-spotlight';

let pendingOpen = false;

/** The command palette (Core CommandPalette and its React Aria modal) loads on first use. */
export const postSpotlightPalette = onDemandModule(() => import('./PostSpotlight'));

export function consumePostSpotlightOpen() {
  const pending = pendingOpen;
  pendingOpen = false;
  return pending;
}

/** True while an open request waits for the palette to mount; does not consume it. */
export function hasPendingPostSpotlightOpen() {
  return pendingOpen;
}

export function openPostSpotlight() {
  pendingOpen = true;
  window.dispatchEvent(new Event(POST_SPOTLIGHT_OPEN_EVENT));
  return postSpotlightPalette.preload();
}

/** Search triggers call this on hover/focus so the palette is ready by the time it is pressed. */
export function preloadPostSpotlight() {
  void postSpotlightPalette.preload();
}
