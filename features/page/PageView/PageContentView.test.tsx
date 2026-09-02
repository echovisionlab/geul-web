// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { PageContentView } from './PageContentView';

const contentLanguageMenuSpy = vi.fn();
const pageRendererSpy = vi.fn();

vi.mock('@/features/translation/ContentLanguageMenu', () => ({
  ContentLanguageMenu: (props: Record<string, unknown>) => {
    contentLanguageMenuSpy(props);
    return <div data-testid="content-language-menu" />;
  },
}));

vi.mock('@/features/translation/LocalizationNotice', () => ({
  LocalizationNotice: () => <div data-testid="localization-notice" />,
}));

vi.mock('@/features/print/PrintButton', () => ({
  PrintButton: () => <button type="button">Print</button>,
}));

vi.mock('./GeneratedPageRenderer', () => ({
  GeneratedPageRenderer: (props: Record<string, unknown>) => {
    pageRendererSpy(props);
    return <div data-testid="page-renderer" />;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<MantineProvider>{node}</MantineProvider>));
}

beforeEach(() => {
  contentLanguageMenuSpy.mockReset();
  pageRendererSpy.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('PageContentView', () => {
  it('uses the canonical layout and shared content chrome', () => {
    render(
      <PageContentView
        pathname="/about"
        requestedLocale="en"
        page={{
          title: 'About',
          showTitle: true,
          documentLayout: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' },
          content: [{ id: 'scene-1', kind: 'immersive-scene', props: {} }] as never,
          blockMedia: [],
          localizationInfo: {
            requestedLocale: 'en',
            displayedLocale: 'en',
            sourceLocale: 'ko',
            isFallback: false,
            isOriginal: false,
            machineGenerated: false,
            fallbackReason: 0,
          },
        }}
      />,
    );

    const layout = document.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-content-height')).toBe('viewport');
    expect(layout?.getAttribute('data-page-chrome')).toBe('pinned');
    expect(layout?.getAttribute('data-footer-layout')).toBe('pinned');
    expect(document.querySelector('[data-content-scroll-root]')).toBeNull();
    expect(document.querySelector('[data-content-body]')).not.toBeNull();
    expect(document.querySelector('[data-content-chrome] h1')?.textContent).toBe('About');
    expect(document.querySelector('[data-content-chrome] button')?.textContent).toBe('Print');
    expect(contentLanguageMenuSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/about', requestedLocale: 'en' }),
    );
    expect(pageRendererSpy).toHaveBeenCalledWith(expect.objectContaining({ sections: expect.any(Array) }));
  });

  it('uses explicit document flow without inspecting block type', () => {
    render(
      <PageContentView
        pathname="/"
        requestedLocale="en"
        page={{
          title: '',
          showTitle: false,
          documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
          content: [
            {
              id: 'scene-1',
              kind: 'immersive-scene',
              props: { playback: 'autoplay', unitsJson: '[{"id":"one"},{"id":"two"}]' },
            },
          ] as never,
          blockMedia: [],
        }}
      />,
    );

    const layout = document.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-content-height')).toBe('content');
    expect(layout?.getAttribute('data-page-chrome')).toBe('flow');
    expect(layout?.getAttribute('data-footer-layout')).toBe('flow');
    expect(document.querySelector('[data-content-scroll-root]')).toBeNull();
  });

  it('renders chrome for an empty page instead of returning null', () => {
    render(
      <PageContentView
        pathname="/empty"
        requestedLocale="en"
        page={{
          title: 'Empty',
          showTitle: true,
          content: null,
          blockMedia: [],
          documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
        }}
      />,
    );

    expect(document.querySelector('[data-content-chrome] h1')?.textContent).toBe('Empty');
    expect(pageRendererSpy).toHaveBeenCalledWith(expect.objectContaining({ sections: [] }));
  });

  it('passes canonical section order without using content for layout classification', () => {
    const sections = [
      { id: 'copy-1', kind: 'rich-text', props: {} },
      { id: 'copy-2', kind: 'rich-text', props: {} },
    ];
    render(
      <PageContentView
        pathname="/"
        requestedLocale="en"
        page={{
          title: '',
          showTitle: false,
          documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
          content: sections as never,
          blockMedia: [],
        }}
      />,
    );

    expect(pageRendererSpy).toHaveBeenCalledWith(expect.objectContaining({ sections }));
  });

  it('switches locale bodies without changing the root document layout', () => {
    const documentLayout = { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'flow' } as const;
    const renderLocale = (requestedLocale: string, sectionId: string) => (
      <PageContentView
        pathname="/localized"
        requestedLocale={requestedLocale}
        page={{
          title: 'Localized',
          showTitle: false,
          documentLayout,
          content: [{ id: sectionId, kind: 'rich-text', settings: {}, props: {} }] as never,
          blockMedia: [],
        }}
      />
    );

    render(renderLocale('en', 'section-en'));
    act(() => root?.render(<MantineProvider>{renderLocale('ko', 'section-ko')}</MantineProvider>));

    const layout = document.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-content-height')).toBe('viewport');
    expect(layout?.getAttribute('data-page-chrome')).toBe('pinned');
    expect(layout?.getAttribute('data-footer-layout')).toBe('flow');
    expect(pageRendererSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sections: [expect.objectContaining({ id: 'section-ko' })],
        requestedLocale: 'ko',
      }),
    );
  });
});
