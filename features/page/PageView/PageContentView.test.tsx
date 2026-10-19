// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { HeadingBlockSchema, HeadingBlockLocaleSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

import { PageContentView } from './PageContentView';

const contentLanguageMenuSpy = vi.fn();
const pageRendererSpy = vi.fn();
const tocSpy = vi.fn();

vi.mock('@/features/navigation/TableOfContents', () => ({
  TableOfContents: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
    tocSpy(props);
    // The navigation owner wraps the sections so Core can reserve the outline beside them.
    return <div data-testid="page-toc">{children}</div>;
  },
}));

vi.mock('@/features/translation/ContentLanguageMenu', () => ({
  ContentLanguageMenu: (props: Record<string, unknown>) => {
    contentLanguageMenuSpy(props);
    return <div data-testid="content-language-menu" />;
  },
}));

vi.mock('@/features/translation/ContentLocaleNotice', () => ({
  ContentLocaleNotice: () => <div data-testid="content-locale-notice" />,
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
  act(() => root?.render(<DesignSystemProvider forceColorScheme="light">{node}</DesignSystemProvider>));
}

beforeEach(() => {
  contentLanguageMenuSpy.mockReset();
  pageRendererSpy.mockReset();
  tocSpy.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = '';
  root = null;
  container = null;
});

describe('PageContentView', () => {
  it('connects rendered rich-text heading IDs and labels to the shared navigation owner', () => {
    render(
      <PageContentView
        pathname="/about"
        requestedLocale="en"
        page={{
          title: 'About',
          showTitle: true,
          blockMedia: [],
          documentLayout: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
          content: [
            {
              id: 'copy',
              kind: 'rich-text',
              settings: {},
              props: {},
              columns: [],
              richText: [
                {
                  id: 'about-heading',
                  kind: 'heading',
                  children: [],
                  base: create(HeadingBlockSchema, { props: { level: 2 } }),
                  locale: create(HeadingBlockLocaleSchema, {
                    content: [{ value: { case: 'text', value: { text: 'About this project' } } }],
                  }),
                },
              ],
            },
          ],
        }}
      />,
    );
    expect(tocSpy).toHaveBeenCalledWith({
      enabled: true,
      items: [{ id: 'about-heading', label: 'About this project', level: 2 }],
    });
    expect(pageRendererSpy.mock.calls[0][0].sections[0].richText[0].id).toBe('about-heading');
  });
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
    expect(document.querySelector('[data-content-chrome] [data-testid="content-language-menu"]')).toBeNull();
    expect(layout?.querySelector('[data-testid="content-language-menu"]')).not.toBeNull();
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
          localizationInfo: {
            requestedLocale: 'en',
            displayedLocale: 'en',
            sourceLocale: 'en',
            isFallback: false,
            isOriginal: true,
            machineGenerated: false,
            fallbackReason: 0,
          },
        }}
      />,
    );

    const layout = document.querySelector('[data-content-layout]');
    expect(layout?.getAttribute('data-content-height')).toBe('content');
    expect(layout?.getAttribute('data-page-chrome')).toBe('flow');
    expect(layout?.getAttribute('data-footer-layout')).toBe('flow');
    expect(layout?.getAttribute('data-has-chrome')).toBe('false');
    expect(layout?.querySelector('[data-testid="content-language-menu"]')).not.toBeNull();
    expect(document.querySelector('[data-content-chrome]')).toBeNull();
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
});

describe('Page content language', () => {
  it('uses the displayed fallback language for title and body while interface controls retain interface language', () => {
    render(
      <PageContentView
        pathname="/translated"
        requestedLocale="en"
        page={{
          title: '한국어 원본',
          showTitle: true,
          content: [],
          blockMedia: [],
          documentLayout: { contentHeight: 'content', pageChrome: 'pinned', footer: 'flow' },
          localizationInfo: {
            requestedLocale: 'en',
            displayedLocale: 'ko',
            sourceLocale: 'ko',
            isFallback: true,
            isOriginal: true,
            machineGenerated: false,
            fallbackReason: 1,
          },
        }}
      />,
    );
    expect(document.querySelector('[data-content-body]')).toHaveAttribute('lang', 'ko');
    expect(document.querySelector('[data-content-chrome]')?.parentElement).toHaveAttribute('lang', 'ko');
    expect(document.querySelector('[data-content-controls]')?.closest('[lang]')).toBeNull();
    // The notice about the unavailable language reads in the interface language, outside the content.
    expect(document.querySelector('[data-testid="content-locale-notice"]')?.closest('[lang]')).toBeNull();
    expect(document.querySelector('h1')).toHaveTextContent('한국어 원본');
  });
});
