// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapSelectionMenu, type MapSelectionMenuLabels } from './MapSelectionMenu';

const labels: MapSelectionMenuLabels = {
  menu: 'Map controls',
  places: 'Places',
  addPlace: 'Add place',
  centerPlace: 'Center map',
  removePlace: 'Remove place',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  width: 'Width',
  resizeHint: 'Drag the side handles to resize',
  resizing: 'Resizing',
  focusCaption: 'Edit caption',
  deleteBlock: 'Delete map',
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

describe('MapSelectionMenu', () => {
  it('exposes place, alignment, caption, width, and delete commands without editor access', () => {
    const onAddPlace = vi.fn();
    const onRemovePlace = vi.fn();
    const onCenterPlace = vi.fn();
    const onChangeAlignment = vi.fn();
    const onFocusCaption = vi.fn();
    const onDelete = vi.fn();

    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <MapSelectionMenu
            labels={labels}
            places={[{ id: 'place-1', name: 'Studio', centered: true }]}
            textAlignment="center"
            previewWidth="64"
            isResizing
            onAddPlace={onAddPlace}
            onRemovePlace={onRemovePlace}
            onCenterPlace={onCenterPlace}
            onChangeAlignment={onChangeAlignment}
            onFocusCaption={onFocusCaption}
            onDelete={onDelete}
          />
        </DesignSystemProvider>,
      );
    });

    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Map controls');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Width: 64% (Resizing)');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('64%');
    expect(container.querySelector('button[aria-label="Align center"]')?.getAttribute('aria-pressed')).toBe('true');

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Align right"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Edit caption"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Delete map"]')?.click());
    expect(onChangeAlignment).toHaveBeenCalledWith('right');
    expect(onFocusCaption).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Places"]')?.click());
    const menuItems = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    act(() => menuItems.find((item) => item.textContent === 'Add place')?.click());
    expect(onAddPlace).toHaveBeenCalledOnce();

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Places"]')?.click());
    const reopenedItems = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    act(() => reopenedItems.find((item) => item.textContent === 'Center map')?.click());
    expect(onCenterPlace).toHaveBeenCalledWith('place-1');

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Places"]')?.click());
    const finalItems = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    act(() => finalItems.find((item) => item.textContent === 'Remove place')?.click());
    expect(onRemovePlace).toHaveBeenCalledWith('place-1');
  });
});
