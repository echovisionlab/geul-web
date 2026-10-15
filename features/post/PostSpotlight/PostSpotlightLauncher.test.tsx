// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

vi.mock('./PostSpotlight', async () => {
  const trigger = await import('./post-spotlight-trigger');
  return {
    // Stand-in for the palette: like PostSpotlight it consumes the pending open request on mount.
    PostSpotlight: function PaletteProbe() {
      const [opened, setOpened] = useState(false);
      useEffect(() => {
        if (trigger.consumePostSpotlightOpen()) {
          setOpened(true);
        }
      }, []);
      return opened ? <div role="dialog" aria-label="Search posts" /> : null;
    },
  };
});

import { PostSpotlightLauncher } from './PostSpotlightLauncher';
import { openPostSpotlight, postSpotlightPalette } from './post-spotlight-trigger';

it('loads the palette on the first request and opens it without dropping that request', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PostSpotlightLauncher />));
  expect(postSpotlightPalette.peek()).toBeUndefined();
  expect(document.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => openPostSpotlight());
  await act(() => postSpotlightPalette.preload());
  expect(document.querySelector('[role="dialog"]')).toHaveAccessibleName('Search posts');

  act(() => root.unmount());
  host.remove();
});
