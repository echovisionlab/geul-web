// @vitest-environment jsdom

// Interaction coverage is separate from the pure view-kind resolver.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { expect, it, vi } from 'vitest';
import { FileBlockView } from './FileBlockView';

it('keeps an empty read-only Tiptap file surface out of the authoring tab order', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  const onActivate = vi.fn();
  act(() => {
    root.render(
      <MantineProvider>
        <FileBlockView
          kind="empty"
          emptyTitle="Upload"
          emptyDescription="Choose a file"
          loadingLabel="Loading"
          emptyInteractive={false}
          onActivate={onActivate}
        />
      </MantineProvider>,
    );
  });

  const surface = element.querySelector<HTMLElement>('.attachment-block--empty');
  expect(surface?.hasAttribute('role')).toBe(false);
  expect(surface?.hasAttribute('tabindex')).toBe(false);
  act(() => surface?.click());
  expect(onActivate).not.toHaveBeenCalled();

  act(() => root.unmount());
  element.remove();
});
