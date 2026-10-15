'use client';
import { useSyncExternalStore } from 'react';
import { breakpointQuery } from '../Layout/breakpoints';

const desktopQuery = breakpointQuery('sm', 'at-least');
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const getDesktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerDesktopSnapshot = () => false;

/** True from the `sm` breakpoint up, where `visibility="mobile-only"` drawers stay closed. */
export function useDrawerDesktop() {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
}
