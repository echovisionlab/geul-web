import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';

const changeAccessEvent = 'storybook:change-room-access';
const ownerSelector = '[data-room-access-scenario]';

/** Keep the provider in the mounted owner's closure, never in a module-wide slot. */
export function bindRoomAccessScenario(owner: HTMLElement, provider: object): () => void {
  const changeAccess = (event: Event) => {
    if ('detail' in event && (event.detail === 'view' || event.detail === 'edit')) {
      setProviderAccessLevel(provider, event.detail);
      event.preventDefault();
    }
  };
  owner.addEventListener(changeAccessEvent, changeAccess);
  return () => owner.removeEventListener(changeAccessEvent, changeAccess);
}

/** A play function may change only the room mounted inside its own canvas. */
export function changeCanvasRoomAccess(canvas: HTMLElement, access: 'view' | 'edit'): boolean {
  const owner = canvas.querySelector<HTMLElement>(ownerSelector);
  const CustomEvent = owner?.ownerDocument.defaultView?.CustomEvent;
  if (!owner || !CustomEvent) {
    return false;
  }
  return !owner.dispatchEvent(new CustomEvent(changeAccessEvent, { detail: access, cancelable: true }));
}
