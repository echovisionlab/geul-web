// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
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
        <MantineProvider env="test">
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
        </MantineProvider>,
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

  it('uses the shared toolbar navigation contract and preserves the editor selection on pointer input', () => {
    const onEscape = vi.fn();
    act(() => {
      root.render(
        <MantineProvider env="test">
          <MapSelectionMenu
            labels={labels}
            places={[]}
            textAlignment="left"
            previewWidth="100"
            editorElement={editorElement}
            navigationEnabled
            onAddPlace={() => undefined}
            onChangeAlignment={() => undefined}
            onFocusCaption={() => undefined}
            onDelete={() => undefined}
            onEscape={onEscape}
          />
        </MantineProvider>,
      );
    });

    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]');
    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-selection-toolbar-action]:not(:disabled)'),
    );
    expect(toolbar?.hasAttribute('tabindex')).toBe(false);
    expect(controls.filter((control) => control.tabIndex === 0)).toHaveLength(1);
    expect(controls[0]?.tabIndex).toBe(0);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editorElement.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controls[0]);

    act(() => {
      controls[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(controls[1]);
    expect(controls[0]?.tabIndex).toBe(-1);
    expect(controls[1]?.tabIndex).toBe(0);

    act(() => {
      controls[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(controls.at(-1));
    act(() => {
      controls.at(-1)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(controls[0]);
    act(() => {
      controls[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(controls.at(-1));
    act(() => {
      controls.at(-1)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(onEscape).toHaveBeenCalledOnce();

    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    expect(toolbar?.dispatchEvent(pointerDown)).toBe(false);
    expect(toolbar?.dispatchEvent(mouseDown)).toBe(false);
  });
});
