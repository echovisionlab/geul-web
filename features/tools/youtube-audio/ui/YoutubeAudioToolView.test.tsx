// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YoutubeAudioToolView, type YoutubeAudioToolViewProps } from './YoutubeAudioToolView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const handlers = { onClear: vi.fn(), onResolve: vi.fn(), onUrlChange: vi.fn() };
const baseProps: YoutubeAudioToolViewProps = {
  labels: {
    title: 'YouTube Audio',
    description: 'Load and convert audio.',
    sourceTitle: 'YouTube source',
    sourceDescription: 'Short-lived source.',
    urlLabel: 'YouTube URL',
    urlDescription: 'Paste a URL.',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    resolve: 'Load audio',
    resolving: 'Loading audio',
    ready: 'Source ready',
    clear: 'Clear source',
  },
  url: '',
  resolving: false,
  error: null,
  resolvedTitle: null,
  converter: null,
  ...handlers,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function render(props: Partial<YoutubeAudioToolViewProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <YoutubeAudioToolView {...baseProps} {...props} />
      </MantineProvider>,
    );
  });
}

describe('YoutubeAudioToolView', () => {
  it('uses the Core URL field and submits only a non-empty source', () => {
    render();
    const input = container.querySelector<HTMLInputElement>('input[type="url"]');
    const form = container.querySelector('form');
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(input?.placeholder).toContain('youtube.com');
    expect(submit?.disabled).toBe(true);

    render({ url: 'https://youtu.be/abcdefghijk' });
    act(() => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(handlers.onResolve).toHaveBeenCalledOnce();
  });

  it('renders source status, converter content, clear action, and a field error', () => {
    render({
      error: 'Enter a valid YouTube URL.',
      resolvedTitle: 'Reference audio',
      converter: <div data-converter>Converter</div>,
      url: 'invalid',
    });
    expect(container.textContent).toContain('Reference audio');
    expect(container.textContent).toContain('Source ready');
    expect(container.textContent).toContain('Enter a valid YouTube URL.');
    expect(container.querySelector('[data-converter]')).not.toBeNull();
    const clear = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Clear source',
    );
    act(() => clear?.click());
    expect(handlers.onClear).toHaveBeenCalledOnce();
  });
});
