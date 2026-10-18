// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarSurface, type ToolbarSurfaceProps } from './ToolbarSurface';
import { IconButton } from '../IconButton';
import { TextInput } from '../Input/TextInput';
import { I18nProvider } from 'react-aria-components';
describe('shared contextual toolbar contract', () => {
  it('owns compact control sizing and embedded appearance without leaking caller skin props', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    const onClick = vi.fn();
    const hostile = { style: { height: 900 }, className: 'foreign', 'data-geul-toolbar-density': 'comfortable' };
    await act(async () =>
      root.render(
        <ToolbarSurface
          {...(hostile as unknown as ToolbarSurfaceProps)}
          label="Formatting"
          density="compact"
          appearance="embedded"
          width="full"
        >
          <IconButton label="Bold" size="chrome" onClick={onClick}>
            B
          </IconButton>
        </ToolbarSurface>,
      ),
    );
    const toolbar = element.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(toolbar.dataset.geulToolbarDensity).toBe('compact');
    expect(toolbar.dataset.geulToolbarAppearance).toBe('embedded');
    expect(toolbar.dataset.geulToolbarWidth).toBe('full');
    expect(toolbar.classList.contains('foreign')).toBe(false);
    expect(toolbar.style.height).toBe('');
    const button = element.querySelector<HTMLButtonElement>('button')!;
    expect(button.dataset.controlSize).toBe('compact');
    await act(async () => button.click());
    expect(onClick).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    element.remove();
  });
  it('moves keyboard focus past disabled controls and respects RTL', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () =>
      root.render(
        <ToolbarSurface label="Commands" appearance="inline">
          <IconButton label="Focus">F</IconButton>
          <IconButton label="Unavailable" disabled>
            U
          </IconButton>
          <span inert>
            <IconButton label="Inert">I</IconButton>
          </span>
          <ToolbarSurface label="Nested">
            <IconButton label="Nested command">N</IconButton>
          </ToolbarSurface>
          <IconButton label="Export">E</IconButton>
          <IconButton label="Delete">D</IconButton>
        </ToolbarSurface>,
      ),
    );
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => !['Inert', 'Nested command'].includes(button.getAttribute('aria-label')!),
    );
    const toolbar = element.querySelector<HTMLElement>('[role="toolbar"]')!;
    await act(async () => buttons[0].focus());
    await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(buttons[2]);
    await act(async () => buttons[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(buttons[3]);
    await act(async () => buttons[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(buttons[0]);
    // A theme/locale-owned direction changes movement without changing command order.
    toolbar.style.direction = 'rtl';
    await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(document.activeElement).toBe(buttons[2]);
    await act(async () => root.unmount());
    element.remove();
  });

  it('skips pending, CSS-hidden and fieldset-disabled commands', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () =>
      root.render(
        <ToolbarSurface label="Commands">
          <IconButton label="Start">S</IconButton>
          <IconButton label="Pending" loading>
            P
          </IconButton>
          <span data-css-hidden>
            <IconButton label="Hidden">H</IconButton>
          </span>
          <fieldset disabled>
            <button type="button">Unavailable group</button>
          </fieldset>
          <IconButton label="Export">E</IconButton>
        </ToolbarSurface>,
      ),
    );
    element.querySelector<HTMLElement>('[data-css-hidden]')!.style.display = 'none';
    const start = element.querySelector<HTMLElement>('[aria-label="Start"]')!;
    await act(async () => start.focus());
    await act(async () =>
      start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(element.querySelector('[aria-label="Export"]'));
    await act(async () => root.unmount());
    element.remove();
  });

  it('keeps native input keys and consumer-handled command keys untouched', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () =>
      root.render(
        <I18nProvider locale="en">
          <ToolbarSurface
            label="Commands"
            onKeyDown={(event) => {
              if (event.key === 'End') {
                event.preventDefault();
              }
            }}
          >
            <TextInput aria-label="Search" />
            <IconButton label="Start">S</IconButton>
            <IconButton label="Export">E</IconButton>
          </ToolbarSurface>
        </I18nProvider>,
      ),
    );
    const input = element.querySelector('input')!;
    await act(async () => input.focus());
    const key = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    await act(async () => input.dispatchEvent(key));
    expect(key.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    const start = element.querySelector<HTMLElement>('[aria-label="Start"]')!;
    await act(async () => start.focus());
    await act(async () =>
      start.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(start);
    await act(async () => root.unmount());
    element.remove();
  });

  it('keeps nested toolbar focus and density within its own command group', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () =>
      root.render(
        <ToolbarSurface label="Outer" density="compact">
          <IconButton label="Outer command">O</IconButton>
          <ToolbarSurface label="Inner" density="comfortable">
            <IconButton label="Inner start" size="sm">
              S
            </IconButton>
            <IconButton label="Inner end" size="sm">
              E
            </IconButton>
          </ToolbarSurface>
        </ToolbarSurface>,
      ),
    );
    const outer = element.querySelector<HTMLElement>('[aria-label="Outer command"]')!;
    const start = element.querySelector<HTMLElement>('[aria-label="Inner start"]')!;
    expect(outer.dataset.controlSize).toBe('compact');
    expect(start.dataset.controlSize).toBe('sm');
    await act(async () => start.focus());
    await act(async () =>
      start.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })),
    );
    expect(document.activeElement).toBe(element.querySelector('[aria-label="Inner end"]'));
    await act(async () => root.unmount());
    element.remove();
  });
});
