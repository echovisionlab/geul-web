// @vitest-environment jsdom

// Interaction coverage is separate from the pure view-kind resolver.

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { expect, it, vi } from 'vitest';
import { FileBlockView } from './FileBlockView';

it('keeps an empty read-only Tiptap file surface out of the authoring tab order', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  const onActivate = vi.fn();
  act(() => {
    root.render(
      <DesignSystemProvider forceColorScheme="light">
        <FileBlockView
          kind="empty"
          emptyTitle="Upload"
          emptyDescription="Choose a file"
          loadingLabel="Loading"
          emptyInteractive={false}
          onActivate={onActivate}
        />
      </DesignSystemProvider>,
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

it('exposes an interactive empty file surface as one native button named by its visible text', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  const onActivate = vi.fn();
  act(() => {
    root.render(
      <DesignSystemProvider forceColorScheme="light">
        <FileBlockView
          kind="empty"
          emptyTitle="Upload"
          emptyDescription="Choose a file"
          loadingLabel="Loading"
          onActivate={onActivate}
        />
      </DesignSystemProvider>,
    );
  });

  const surface = element.querySelector<HTMLElement>('.attachment-block--empty');
  expect(surface?.hasAttribute('role')).toBe(false);
  const buttons = surface?.querySelectorAll('button') ?? [];
  expect(buttons).toHaveLength(1);
  expect(buttons[0]?.textContent).toContain('Upload');
  expect(buttons[0]?.textContent).toContain('Choose a file');
  act(() => buttons[0]?.click());
  expect(onActivate).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
  element.remove();
});
