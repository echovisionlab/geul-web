// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { getThemeTokens, type ThemeId } from '@/lib/theme/themes';
import enMessages from '../../../messages/en.json';
import koMessages from '../../../messages/ko.json';
import { PatternDocumentation } from '../Patterns.stories';
import { PageContractDocumentation, PageDocumentationBrowser } from './PageDocumentation';

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
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(node: ReactNode, locale: 'ko' | 'en' = 'ko', theme: ThemeId = 'ocean-dark') {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? koMessages : enMessages}>
        <DesignSystemProvider locale={locale} forceTheme={theme}>
          {node}
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    ),
  );
}

describe('English documentation within the shared Storybook environment', () => {
  it('keeps page tasks and labels in English while preserving the active custom theme', () => {
    render(<PageDocumentationBrowser initialRoute="/login" />);
    expect(host.querySelector('h1')?.textContent).toBe('Page documentation');
    expect(host.textContent).toContain('Request an email code and complete sign-in.');
    expect(host.textContent).toContain('No result recorded in this catalog');
    expect(host.textContent).not.toMatch(/[가-힣]/);
    expect(host.querySelector('[lang="en"]')).not.toBeNull();
    expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe(
      getThemeTokens('ocean-dark').surface,
    );

    render(<PageDocumentationBrowser initialRoute="/login" />, 'en', 'ocean-light');
    expect(host.querySelector('h1')?.textContent).toBe('Page documentation');
    expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe(
      getThemeTokens('ocean-light').surface,
    );
  });

  it('keeps route warnings and shared-branch documentation explicit', () => {
    render(<PageDocumentationBrowser initialRoute="/admin/forms/[id]/submissions" />);
    expect(host.textContent).toContain('Blocked by a terminal parent layout');
    expect(host.textContent).toContain('A View story does not establish that the production route is reachable.');

    render(<PageContractDocumentation title="Pages/Admin/Content Lists" />);
    expect(host.textContent).toContain('Choose a route sharing this View');
    expect(host.textContent).toContain('Other branches and states in this story file');
    expect(host.querySelector('a[href*="/docs/"]')?.getAttribute('href')).toContain('--documentation');
  });

  it('provides stable unique TOC anchors for every populated page heading', () => {
    const documentation = (
      <>
        <PageDocumentationBrowser initialRoute="/forms/[slug]" />
        <PageContractDocumentation title="Pages/Editors/Form" />
        <PageContractDocumentation title="Pages/Forms/Public Response" />
      </>
    );
    render(documentation);
    const headings = Array.from(host.querySelectorAll<HTMLHeadingElement>('h2, h3')).filter((heading) =>
      heading.textContent?.trim(),
    );
    const ids = headings.map((heading) => heading.id);
    expect(headings.length).toBeGreaterThan(6);
    expect(ids.every((id) => id.trim().length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const heading of headings) {
      expect(document.getElementById(heading.id)).toBe(heading);
    }

    render(documentation, 'en', 'ocean-light');
    expect(Array.from(host.querySelectorAll<HTMLHeadingElement>('h2, h3'), (heading) => heading.id)).toEqual(ids);
  });

  it('keeps pattern instructions English while the live fixture follows the toolbar locale', () => {
    render(<PatternDocumentation pattern="form" state="ready" />);
    expect(host.querySelector('h1')?.textContent).toBe('Patterns · Input → validate → save');
    expect(host.textContent).toContain('Usage contract');
    const fixture = host.querySelector('[lang="ko"]');
    expect(fixture).not.toBeNull();
    expect(fixture?.textContent).toContain(koMessages.common.labels.name);
    expect(fixture?.querySelector('button[type="submit"]')?.textContent).toContain(koMessages.common.actions.create);
    expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe(
      getThemeTokens('ocean-dark').surface,
    );

    render(<PatternDocumentation pattern="form" state="ready" />, 'en');
    expect(host.querySelector('h1')?.textContent).toBe('Patterns · Input → validate → save');
    expect(host.querySelector('button[type="submit"]')?.textContent).toContain('Create collection');
  });
});
