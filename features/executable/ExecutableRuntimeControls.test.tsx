// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

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
        <DesignSystemProvider forceColorScheme="light">
          <ExecutableRuntimeStatus status="running" running="Running" stopped="Stopped" />
        </DesignSystemProvider>,
      );
    });

    const status = host.querySelector<HTMLElement>('[data-executable-runtime-status]');
    expect(status?.tagName).toBe('SPAN');
    expect(status?.textContent).toBe('Running');
    expect(status?.dataset.placement).toBe('overlay-start');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.style.padding).toBe('');

    act(() => root.unmount());
  });

  it('renders authoring and public titles with the same title-row contract', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const onChange = vi.fn();

    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ExecutableBlockTitle title="" fallback="Three.js scene" editable onChange={onChange} />
          <ExecutableBlockTitle title="Localized scene" fallback="Three.js scene" editable={false} />
        </DesignSystemProvider>,
      );
    });

    const rows = host.querySelectorAll('[data-executable-title]');
    expect(rows).toHaveLength(2);
    const titleInput = host.querySelector<HTMLInputElement>('[data-executable-title-input]');
    expect(titleInput?.value).toBe('');
    expect(titleInput?.placeholder).toBe('Three.js scene');
    expect(titleInput?.closest('[data-executable-title]')).not.toBeNull();
    expect(host.querySelector('figcaption')?.textContent).toBe('Localized scene');
    expect((rows[0] as HTMLElement).style.padding).toBe((rows[1] as HTMLElement).style.padding);
    expect((rows[0] as HTMLElement).style.color).toBe((rows[1] as HTMLElement).style.color);
    expect((rows[0] as HTMLElement).style.borderBottom).toBe('');
    expect((rows[1] as HTMLElement).style.borderBottom).toBe('');

    act(() => root.unmount());
  });

  it('can clear and replace an authored title without persisting fallback copy', () => {
    function Titles() {
      const [title, setTitle] = useState('Original scene');
      return (
        <>
          <ExecutableBlockTitle title={title} fallback="Three.js scene" editable onChange={setTitle} />
          <ExecutableBlockTitle title={title} fallback="Three.js scene" editable={false} />
        </>
      );
    }
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <Titles />
        </DesignSystemProvider>,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('[data-executable-title-input]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const title of ['', '밤하늘 Scene', '']) {
      act(() => {
        setValue.call(input, title);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(input.value).toBe(title);
      expect(host.querySelector('figcaption')?.textContent).toBe(title || 'Three.js scene');
    }
    act(() => root.unmount());
  });

  it('keeps stop, restart and original reset in one transparent icon-control row', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const callbacks = { stop: vi.fn(), restart: vi.fn(), reset: vi.fn() };

    act(() => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ExecutableRuntimeControls
            type="p5Sketch"
            running
            labels={{ run: 'Run', stop: 'Stop', restart: 'Restart', resetOriginal: 'Reset to original' }}
            onRun={callbacks.restart}
            onStop={callbacks.stop}
            onRestart={callbacks.restart}
            onResetOriginal={callbacks.reset}
          />
        </DesignSystemProvider>,
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

    act(() => buttons.forEach((button) => button.click()));
    expect(callbacks.stop).toHaveBeenCalledOnce();
    expect(callbacks.restart).toHaveBeenCalledOnce();
    expect(callbacks.reset).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });
});
