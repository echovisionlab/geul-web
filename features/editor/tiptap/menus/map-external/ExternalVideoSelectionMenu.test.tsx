// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
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
        <MantineProvider env="test">
          <ExternalVideoSelectionMenu
            labels={labels}
            aspectRatio="16:9"
            textAlignment="left"
            previewWidth="72"
            onEditLink={onEditLink}
            onChangeAspectRatio={onChangeAspectRatio}
            onChangeAlignment={onChangeAlignment}
          />
        </MantineProvider>,
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

  it('bridges editor Tab to the first eligible action and exposes one toolbar tab stop', () => {
    const onEscape = vi.fn();
    act(() => {
      root.render(
        <MantineProvider env="test">
          <ExternalVideoSelectionMenu
            labels={labels}
            aspectRatio="auto"
            textAlignment="left"
            previewWidth="100"
            editorElement={editorElement}
            navigationEnabled
            onChangeAspectRatio={() => undefined}
            onChangeAlignment={() => undefined}
            onEscape={onEscape}
          />
        </MantineProvider>,
      );
    });

    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!;
    const marked = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-selection-toolbar-action]')];
    const eligible = marked.filter((action) => !action.disabled);
    expect(toolbar.hasAttribute('tabindex')).toBe(false);
    expect(marked[0]?.disabled).toBe(true);
    expect(marked[0]?.tabIndex).toBe(-1);
    expect(eligible.filter((action) => action.tabIndex === 0)).toHaveLength(1);

    const nativeTabStops = [
      ...toolbar.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'),
    ].filter((element) => element.tabIndex === 0);
    expect(nativeTabStops).toEqual([eligible[0]]);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => editorElement.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(eligible[0]);

    act(() => {
      eligible[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(eligible.at(-1));
    act(() => {
      eligible
        .at(-1)
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(eligible.at(-2));
    act(() => {
      eligible.at(-2)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(onEscape).toHaveBeenCalledOnce();
  });
});
