// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalVideoSelectionMenu, type ExternalVideoSelectionMenuLabels } from './ExternalVideoSelectionMenu';

const labels: ExternalVideoSelectionMenuLabels = {
  menu: 'External video controls',
  editLink: 'Edit link',
  aspectRatio: 'Aspect ratio',
  automaticAspectRatio: 'Automatic',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  width: 'Width',
  resizeHint: 'Drag the side handles to resize',
};

let container: HTMLDivElement;
let editorElement: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  editorElement = document.createElement('div');
  editorElement.contentEditable = 'true';
  document.body.appendChild(container);
  document.body.appendChild(editorElement);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  editorElement.remove();
});

describe('ExternalVideoSelectionMenu', () => {
  it('sends link, aspect ratio, and alignment commands through typed ports', () => {
    const onEditLink = vi.fn();
    const onChangeAspectRatio = vi.fn();
    const onChangeAlignment = vi.fn();

    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ExternalVideoSelectionMenu
            labels={labels}
            aspectRatio="16:9"
            textAlignment="left"
            previewWidth="72"
            onEditLink={onEditLink}
            onChangeAspectRatio={onChangeAspectRatio}
            onChangeAlignment={onChangeAlignment}
          />
        </DesignSystemProvider>,
      );
    });

    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('External video controls');
    expect(container.querySelector('button[aria-label="Align left"]')?.getAttribute('aria-pressed')).toBe('true');

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Align center"]')?.click());
    expect(onEditLink).toHaveBeenCalledOnce();
    expect(onChangeAlignment).toHaveBeenCalledWith('center');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Width: 72%');

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Aspect ratio"]')?.click());
    const ratioItem = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(
      (item) => item.textContent === '4:3',
    );
    act(() => ratioItem?.click());
    expect(onChangeAspectRatio).toHaveBeenCalledWith('4:3');
  });
});
