// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapLoadingState, type MapLoadingMessages } from './useMapLoadingState';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeProps {
  messages?: MapLoadingMessages;
}

function LoadingStateProbe({ messages }: ProbeProps) {
  const { loadingStage, loadingMessage, setLoadingStage } = useMapLoadingState(messages);

  return (
    <div>
      <span data-stage>{loadingStage}</span>
      <span data-message>{loadingMessage ?? 'none'}</span>
      <button type="button" onClick={() => setLoadingStage('rendering')}>
        Render
      </button>
      <button type="button" onClick={() => setLoadingStage('ready')}>
        Ready
      </button>
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useMapLoadingState', () => {
  it('preserves the no-argument translated loading messages', () => {
    act(() => root.render(<LoadingStateProbe />));

    expect(container.querySelector('[data-stage]')?.textContent).toBe('connecting');
    expect(container.querySelector('[data-message]')?.textContent).toBe('map.loading.connecting');

    act(() => vi.advanceTimersByTime(100));

    expect(container.querySelector('[data-stage]')?.textContent).toBe('loading');
    expect(container.querySelector('[data-message]')?.textContent).toBe('map.loading.loading');
  });

  it('uses injected messages and clears the message once ready', () => {
    act(() =>
      root.render(
        <LoadingStateProbe
          messages={{
            connecting: 'Connecting to tiles',
            loading: 'Loading tiles',
            rendering: 'Rendering map',
          }}
        />,
      ),
    );

    expect(container.querySelector('[data-message]')?.textContent).toBe('Connecting to tiles');

    act(() => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(container.querySelector('[data-message]')?.textContent).toBe('Rendering map');

    const readyButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'Ready',
    );
    act(() => readyButton?.click());
    expect(container.querySelector('[data-stage]')?.textContent).toBe('ready');
    expect(container.querySelector('[data-message]')?.textContent).toBe('none');
  });
});
