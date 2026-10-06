// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://parent.example"}

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { useLocale } from 'next-intl';
import { EmbedFrame } from './EmbedFrame';
import { parseEmbedProps, type EmbedProps } from './schema';
import { loadToolModule } from './loadToolModule';

vi.mock('./loadToolModule', () => ({ loadToolModule: vi.fn() }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: vi.fn(() => 'en') }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
function render(props: Partial<EmbedProps>, preview = false) {
  act(() =>
    root.render(
      <MantineProvider>
        <EmbedFrame props={parseEmbedProps(props)} preview={preview} />
      </MantineProvider>,
    ),
  );
}
function resize(
  frame: HTMLIFrameElement,
  height: unknown,
  origin = 'https://embed.example',
  source: Window | null = frame.contentWindow,
) {
  act(() =>
    window.dispatchEvent(new MessageEvent('message', { source, origin, data: { type: 'geul:embed:resize', height } })),
  );
}

beforeEach(() => {
  vi.mocked(loadToolModule).mockReset();
  vi.mocked(useLocale).mockReturnValue('en');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('EmbedFrame security and lifecycle', () => {
  it('mounts a newly named trusted tool directly without iframe permissions or height styling', async () => {
    const destroy = vi.fn();
    const mount = vi.fn(async (host: HTMLElement) => {
      host.attachShadow({ mode: 'open' }).textContent = 'Native content';
      return { update: vi.fn(), destroy };
    });
    vi.mocked(loadToolModule).mockResolvedValue({ mount });
    const uri = 'https://tools-just-added.parent.example/embed/index.js';
    render({ uri, heightMode: 'viewport', allowScripts: 'false' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadToolModule).toHaveBeenCalledWith(uri);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[style*="height"]')).toBeNull();
    render({ uri: 'https://parent.example/embed/index.mjs', allowSameOrigin: 'true', allowScripts: 'true' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('unsafeOrigin');
  });
  it('rejects untrusted executable URLs before import and keeps external pages on the iframe path', () => {
    render({ uri: 'https://attacker.example/embed/index.js' });
    expect(container.textContent).toContain('toolOriginError');
    expect(loadToolModule).not.toHaveBeenCalled();
    expect(container.querySelector('iframe')).toBeNull();
    render({ uri: 'https://attacker.example/page' });
    expect(container.querySelector('iframe')?.src).toBe('https://attacker.example/page');
    expect(loadToolModule).not.toHaveBeenCalled();
  });
  it('never emits an iframe during SSR without the actual parent origin', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <EmbedFrame props={parseEmbedProps({ uri: 'https://embed.example' })} />
      </MantineProvider>,
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('min-height:640px');
  });

  it('remounts on permission changes and revokes sandbox and device access', () => {
    render({ uri: 'https://embed.example', allowMicrophone: 'true', allowForms: 'true' });
    const first = container.querySelector('iframe')!;
    expect(first.getAttribute('sandbox')).toContain('allow-forms');
    expect(first.getAttribute('allow')).toContain("microphone 'src'");
    render({ uri: 'https://embed.example', allowMicrophone: 'false', allowForms: 'false', allowScripts: 'false' });
    const next = container.querySelector('iframe')!;
    expect(next).not.toBe(first);
    expect(next.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(next.getAttribute('sandbox')).not.toContain('allow-forms');
    expect(next.getAttribute('allow')).toContain("microphone 'none'");
    expect(next.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('uses fallback height and trusts resize only from the current frame and exact origin', () => {
    render({ uri: 'https://embed.example', heightMode: 'auto', height: '480' });
    const frame = container.querySelector('iframe')!;
    expect(frame.style.height).toBe('480px');
    resize(frame, 900, 'https://other.example');
    resize(frame, 900, 'https://embed.example', window);
    resize(frame, Number.NaN);
    expect(frame.style.height).toBe('480px');
    resize(frame, 900);
    expect(frame.style.height).toBe('900px');
    resize(frame, 12765.5);
    expect(frame.style.height).toBe('12766px');
    resize(frame, 331.484);
    expect(frame.style.height).toBe('332px');
    render({ uri: 'https://replacement.example', heightMode: 'auto', height: '480' });
    const replacement = container.querySelector('iframe')!;
    expect(replacement).not.toBe(frame);
    expect(replacement.style.height).toBe('480px');
    resize(frame, 1200);
    expect(replacement.style.height).toBe('480px');
  });

  it('ignores resize in fixed and viewport modes and gates preview interaction', () => {
    render({ uri: 'https://embed.example', height: '480' }, true);
    let frame = container.querySelector('iframe')!;
    resize(frame, 900);
    expect(frame.style.height).toBe('480px');
    expect(frame.style.pointerEvents).toBe('none');
    expect(frame.tabIndex).toBe(-1);
    const activate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'activatePreview',
    )!;
    act(() => activate.click());
    expect(frame.style.pointerEvents).toBe('auto');
    render({ uri: 'https://embed.example', heightMode: 'viewport' });
    frame = container.querySelector('iframe')!;
    const height = frame.style.height;
    resize(frame, 900);
    expect(frame.style.height).toBe(height);
    expect(height).toContain('80dvh');
  });

  it('sends locale initialization only to the exact source origin and updates existing frames', () => {
    render({ uri: 'https://embed.example/tool' });
    const frame = container.querySelector('iframe')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    act(() => frame.dispatchEvent(new Event('load')));
    expect(post).toHaveBeenCalledWith(
      { type: 'geul:embed:init', locale: 'en', colorScheme: 'light' },
      'https://embed.example',
    );
    vi.mocked(useLocale).mockReturnValue('ko');
    render({ uri: 'https://embed.example/tool' });
    expect(container.querySelector('iframe')).toBe(frame);
    expect(post).toHaveBeenLastCalledWith(
      { type: 'geul:embed:init', locale: 'ko', colorScheme: 'light' },
      'https://embed.example',
    );
    render({ uri: 'https://embed.example/tool', allowSameOrigin: 'false' });
    const restricted = container.querySelector('iframe')!;
    const restrictedPost = vi.spyOn(restricted.contentWindow!, 'postMessage');
    act(() => restricted.dispatchEvent(new Event('load')));
    act(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: restricted.contentWindow,
          origin: 'https://embed.example',
          data: { type: 'geul:embed:ready' },
        }),
      ),
    );
    expect(restrictedPost).not.toHaveBeenCalled();
  });

  it('initializes a late ready child only from the current frame and exact origin in every height mode', () => {
    vi.mocked(useLocale).mockReturnValue('ko');
    for (const heightMode of ['auto', 'fixed', 'viewport'] as const) {
      render({ uri: 'https://embed.example/tool', heightMode });
      const frame = container.querySelector('iframe')!;
      const initialHeight = frame.style.height;
      const post = vi.spyOn(frame.contentWindow!, 'postMessage');
      act(() => frame.dispatchEvent(new Event('load')));
      post.mockClear();
      const ready = (source: Window | null, origin: string, data: unknown = { type: 'geul:embed:ready' }) =>
        act(() => window.dispatchEvent(new MessageEvent('message', { source, origin, data })));
      ready(window, 'https://embed.example');
      ready(frame.contentWindow, 'https://untrusted.example');
      ready(frame.contentWindow, 'https://embed.example', 'geul:embed:ready');
      expect(post).not.toHaveBeenCalled();
      ready(frame.contentWindow, 'https://embed.example');
      expect(post).toHaveBeenCalledExactlyOnceWith(
        { type: 'geul:embed:init', locale: 'ko', colorScheme: 'light' },
        'https://embed.example',
      );
      expect(frame.style.height).toBe(initialHeight);
      resize(frame, 331.484);
      expect(frame.style.height).toBe(heightMode === 'auto' ? '332px' : initialHeight);
    }
  });

  it('refuses scripts with same-origin access at the actual parent origin', () => {
    const uri = `${window.location.origin}/tool`;
    render({ uri, allowScripts: 'true', allowSameOrigin: 'true' });
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('unsafeOrigin');
    render({ uri, allowScripts: 'false', allowSameOrigin: 'true' });
    expect(container.querySelector('iframe')).not.toBeNull();
  });
});
