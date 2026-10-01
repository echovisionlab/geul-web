// @vitest-environment jsdom

import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationIntentProvider } from './NavigationIntentProvider';
import { NavigationLink } from './NavigationLink';

const nextLinkMock = vi.hoisted(() => ({
  onNavigate: null as null | ((event: { preventDefault: () => void }) => void),
}));

vi.mock('next/link', async () => {
  const React = await import('react');

  const MockNextLink = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>((props, ref) => {
    const {
      href,
      onNavigate,
      children,
      replace,
      scroll,
      prefetch,
      locale,
      shallow,
      passHref,
      legacyBehavior,
      transitionTypes,
      ...anchorProps
    } = props;
    nextLinkMock.onNavigate = onNavigate as typeof nextLinkMock.onNavigate;
    const renderedHref = typeof href === 'string' ? href : '/from-url-object?edition=2';

    return React.createElement(
      'a',
      {
        ...(anchorProps as import('react').AnchorHTMLAttributes<HTMLAnchorElement>),
        href: renderedHref,
        ref,
      },
      children as ReactNode,
    );
  });

  return { default: MockNextLink };
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  nextLinkMock.onNavigate = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

function simulateNextNavigation(event: { preventDefault: () => void }) {
  if (!nextLinkMock.onNavigate) {
    throw new Error('Next Link did not receive the navigation callback');
  }
  act(() => nextLinkMock.onNavigate?.(event));
}

describe('NavigationLink', () => {
  it('passes the clicked anchor href and navigation options to the generic guard', () => {
    const guard = vi.fn();
    const ref = createRef<HTMLAnchorElement>();

    render(
      <NavigationIntentProvider onNavigationIntent={guard}>
        <NavigationLink
          href={{ pathname: '/documents', query: { edition: '2' } }}
          replace
          scroll={false}
          aria-label="Open document"
          ref={ref}
        >
          Document
        </NavigationLink>
      </NavigationIntentProvider>,
    );

    const anchor = host.querySelector('a');
    expect(anchor).toBe(ref.current);
    expect(anchor?.href).toBe('http://localhost:3000/from-url-object?edition=2');
    expect(anchor?.getAttribute('aria-label')).toBe('Open document');

    const preventDefault = vi.fn();
    simulateNextNavigation({ preventDefault });

    expect(guard).toHaveBeenCalledExactlyOnceWith(
      { href: 'http://localhost:3000/from-url-object?edition=2', replace: true, scroll: false },
      { preventDefault: expect.any(Function) },
    );
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('calls the original onNavigate first and respects its preventDefault decision', () => {
    const calls: string[] = [];
    const guard = vi.fn(() => calls.push('guard'));
    const onNavigate = vi.fn((event: { preventDefault: () => void }) => {
      calls.push('caller');
      event.preventDefault();
    });

    render(
      <NavigationIntentProvider onNavigationIntent={guard}>
        <NavigationLink href="/private" onNavigate={onNavigate}>
          Private
        </NavigationLink>
      </NavigationIntentProvider>,
    );

    const preventDefault = vi.fn();
    simulateNextNavigation({ preventDefault });

    expect(calls).toEqual(['caller']);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(guard).not.toHaveBeenCalled();
  });

  it('keeps ordinary links unguarded when no intent provider is mounted', () => {
    const onNavigate = vi.fn();
    render(
      <NavigationLink href="/normal" onNavigate={onNavigate}>
        Normal
      </NavigationLink>,
    );

    const preventDefault = vi.fn();
    simulateNextNavigation({ preventDefault });

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
