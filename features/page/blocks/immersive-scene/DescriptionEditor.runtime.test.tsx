// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImmersiveSceneDescriptionEditor } from './DescriptionEditor';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    await new Promise((resolve) => setTimeout(resolve, 2));
  });
  host?.remove();
  root = null;
  host = null;
});

describe('ImmersiveSceneDescriptionEditor', () => {
  it.each(['description', 'attribution'] as const)(
    'uses the toolbar-free shared Tiptap profile for %s',
    async (variant) => {
      host = document.createElement('div');
      document.body.append(host);
      root = createRoot(host);

      await act(async () => {
        root?.render(
          <MantineProvider>
            <ImmersiveSceneDescriptionEditor label={variant} value="Scene copy" onChange={vi.fn()} variant={variant} />
          </MantineProvider>,
        );
      });

      expect(host.querySelector('[data-profile="immersive-scene-copy"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="immersive-scene-description-content"]')?.textContent).toContain(
        'Scene copy',
      );
      expect(host.querySelector('[data-testid="immersive-scene-description-toolbar"]')).toBeNull();
      expect(host.querySelector('button')).toBeNull();
    },
  );
});
