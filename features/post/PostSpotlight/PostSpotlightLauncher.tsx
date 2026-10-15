'use client';

import { useEffect, useState } from 'react';
import { useHotkeys } from '@mantine/hooks';
import { useOnDemandModule } from '@/components/core/on-demand-module';
import {
  hasPendingPostSpotlightOpen,
  openPostSpotlight,
  POST_SPOTLIGHT_OPEN_EVENT,
  postSpotlightPalette,
} from './post-spotlight-trigger';

const noHotkeys: Parameters<typeof useHotkeys>[0] = [];
const launcherHotkeys: Parameters<typeof useHotkeys>[0] = [['mod + K', openPostSpotlight]];

/**
 * Mounts post search on first request. Until then only the shortcut and the open event are
 * handled here; the palette module (and its modal code) loads on the first request or when a
 * search trigger is hovered/focused. The request flag in `post-spotlight-trigger` keeps the open
 * request until `PostSpotlight` mounts and consumes it, so the first press is never dropped.
 */
export function PostSpotlightLauncher() {
  const [requested, setRequested] = useState(false);
  const loaded = useOnDemandModule(postSpotlightPalette, requested);
  useEffect(() => {
    const request = () => setRequested(true);
    window.addEventListener(POST_SPOTLIGHT_OPEN_EVENT, request);
    if (hasPendingPostSpotlightOpen()) {
      request();
    }
    return () => window.removeEventListener(POST_SPOTLIGHT_OPEN_EVENT, request);
  }, []);
  // After the palette mounts it owns the shortcut.
  useHotkeys(loaded ? noHotkeys : launcherHotkeys);
  return loaded ? <loaded.PostSpotlight /> : null;
}
