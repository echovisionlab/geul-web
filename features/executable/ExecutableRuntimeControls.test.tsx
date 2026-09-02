// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExecutableBlockTitle, ExecutableRuntimeControls, ExecutableRuntimeStatus } from './ExecutableRuntimeControls';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ExecutableRuntimeControls', () => {
  it('uses one explicit runtime status style independent of prose inheritance', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <MantineProvider>
          <ExecutableRuntimeStatus status="running" running="Running" stopped="Stopped" />
        </MantineProvider>,
      );
    });

    const status = host.querySelector<HTMLElement>('[data-executable-runtime-status]');
    expect(status?.tagName).toBe('SPAN');
    expect(status?.textContent).toBe('Running');
    expect(status?.style.fontSize).toBe('var(--mantine-font-size-xs)');
    expect(status?.style.color).toBe('var(--mantine-color-dimmed)');
    expect(status?.style.padding).toBe('2px 5px');

    act(() => root.unmount());
  });

  it('renders authoring and public titles with the same title-row contract', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const onChange = vi.fn();

    act(() => {
      root.render(
        <MantineProvider>
          <ExecutableBlockTitle title="" fallback="Three.js scene" editable onChange={onChange} />
          <ExecutableBlockTitle title="Localized scene" fallback="Three.js scene" editable={false} />
        </MantineProvider>,
      );
    });

    const rows = host.querySelectorAll('[data-executable-title]');
    expect(rows).toHaveLength(2);
    const titleInput = host.querySelector<HTMLInputElement>('[data-core-executable-title-input]');
    expect(titleInput?.value).toBe('Three.js scene');
    expect(titleInput?.closest('.mantine-TextInput-root')).not.toBeNull();
    expect(host.querySelector('figcaption')?.textContent).toBe('Localized scene');
    expect((rows[0] as HTMLElement).style.padding).toBe((rows[1] as HTMLElement).style.padding);
    expect((rows[0] as HTMLElement).style.color).toBe((rows[1] as HTMLElement).style.color);
    expect((rows[0] as HTMLElement).style.borderBottom).toBe('');
    expect((rows[1] as HTMLElement).style.borderBottom).toBe('');

    act(() => root.unmount());
  });

  it('keeps stop, restart and original reset in one transparent icon-control row', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const callbacks = { stop: vi.fn(), restart: vi.fn(), reset: vi.fn() };

    act(() => {
      root.render(
        <MantineProvider>
          <ExecutableRuntimeControls
            type="p5Sketch"
            running
            labels={{ run: 'Run', stop: 'Stop', restart: 'Restart', resetOriginal: 'Reset to original' }}
            onRun={callbacks.restart}
            onStop={callbacks.stop}
            onRestart={callbacks.restart}
            onResetOriginal={callbacks.reset}
          />
        </MantineProvider>,
      );
    });

    const row = host.querySelector('[data-runtime-controls="p5Sketch"]');
    const buttons = [...row!.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Stop',
      'Restart',
      'Reset to original',
    ]);
    expect(buttons.every((button) => button.getAttribute('data-emphasis') === 'low')).toBe(true);
    expect(buttons.every((button) => button.getAttribute('data-variant') === 'subtle')).toBe(true);

    act(() => buttons.forEach((button) => button.click()));
    expect(callbacks.stop).toHaveBeenCalledOnce();
    expect(callbacks.restart).toHaveBeenCalledOnce();
    expect(callbacks.reset).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });
});
