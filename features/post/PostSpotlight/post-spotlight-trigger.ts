/** Invoke general-layout search without importing its modal renderer. */
export const POST_SPOTLIGHT_OPEN_EVENT = 'geul:open-post-spotlight';

let pendingOpen = false;

export function consumePostSpotlightOpen() {
  const pending = pendingOpen;
  pendingOpen = false;
  return pending;
}

export function openPostSpotlight() {
  pendingOpen = true;
  window.dispatchEvent(new Event(POST_SPOTLIGHT_OPEN_EVENT));
}
