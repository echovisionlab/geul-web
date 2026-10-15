// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';

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
          <NextIntlClientProvider locale="en" timeZone="UTC" messages={{}}>
            <DesignSystemProvider forceColorScheme="light">
              <ImmersiveSceneDescriptionEditor
                label={variant}
                description="Scene text supports Markdown."
                value="Scene copy"
                onChange={vi.fn()}
                variant={variant}
                contentLanguage="ko"
              />
            </DesignSystemProvider>
          </NextIntlClientProvider>,
        );
      });

      expect(host.querySelector('[data-profile="immersive-scene-copy"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="immersive-scene-description-content"]')?.textContent).toContain(
        'Scene copy',
      );
      expect(host.querySelector('[data-testid="immersive-scene-description-toolbar"]')).toBeNull();
      expect(host.querySelector('button')).toBeNull();
      const editor = host.querySelector('[data-testid="immersive-scene-description-content"]');
      expect(editor).toHaveAttribute('role', 'textbox');
      expect(editor).toHaveAccessibleName(variant);
      expect(editor).toHaveAttribute('lang', 'ko');
      expect(editor).toHaveAccessibleDescription('Scene text supports Markdown.');
      expect(editor?.id).toBeTruthy();
      expect(host.querySelector('label')).toHaveAttribute('for', editor?.id);
      expect(host.querySelectorAll(`[id="${editor?.id}"]`)).toHaveLength(1);
    },
  );
});
