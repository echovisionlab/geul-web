// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import { CookieConsentBannerView, type CookieConsentBannerViewModel } from './CookieConsentBannerView';

const model: CookieConsentBannerViewModel = {
  isOpen: true,
  requiresRenewal: false,
  labels: {
    renewalNotice: 'Renew consent',
    intro: 'Essential cookies run the site. Analytics is optional.',
    rejectNonEssential: 'Reject optional',
    analytics: 'Analytics cookies (Google Analytics)',
    acceptAll: 'Accept all',
  },
  learnMore: [
    { text: 'Read ' },
    { text: 'Privacy', href: '/privacy' },
    { text: ' and ' },
    { text: 'Terms', href: '/terms' },
    { text: '.' },
  ],
};

let host: HTMLDivElement;
let root: Root;

function button(name: string) {
  const match = [...host.querySelectorAll<HTMLButtonElement>('button')].find((control) => control.textContent === name);
  if (!match) {
    throw new Error(`Missing button: ${name}`);
  }
  return match;
}

function mount(overrides: Partial<CookieConsentBannerViewModel> = {}) {
  const callbacks = {
    onRejectNonEssential: vi.fn(),
    onAcceptAll: vi.fn(),
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <DesignSystemTestProvider forceColorScheme="light">
        <CookieConsentBannerView model={{ ...model, ...overrides }} {...callbacks} />
      </DesignSystemTestProvider>,
    ),
  );
  return callbacks;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe('CookieConsentBannerView', () => {
  it('exposes the single optional choice through equally available rejection and acceptance', () => {
    mount();
    expect(host.querySelector('[role="switch"]')).toBeNull();
    expect(host.querySelector('aside')).toHaveAccessibleName(model.labels.intro);
    expect(host.querySelectorAll('button')).toHaveLength(2);
    expect(host.querySelector('a[href="/privacy"]')).toHaveAttribute('href', '/privacy');
    expect(host.querySelector('a[href="/terms"]')).toHaveAttribute('href', '/terms');
    expect(document.querySelector('[aria-expanded]')).toBeNull();
  });

  it('keeps renewal guidance and essential/optional context visible', () => {
    mount({ requiresRenewal: true });
    expect(host.querySelector('aside')).toHaveAccessibleName(model.labels.renewalNotice);
    expect([...host.querySelectorAll('*')].find((node) => node.textContent === model.labels.intro)).toBeVisible();
  });

  it('requires an explicit decision and keeps reject and accept callbacks separate', () => {
    const callbacks = mount();
    expect(callbacks.onAcceptAll).not.toHaveBeenCalled();
    expect(callbacks.onRejectNonEssential).not.toHaveBeenCalled();
    act(() => button('Reject optional').click());
    expect(callbacks.onRejectNonEssential).toHaveBeenCalledTimes(1);
    expect(callbacks.onAcceptAll).not.toHaveBeenCalled();
    act(() => button('Accept all').click());
    expect(callbacks.onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it('gives both decisions the same compact text-button size and emphasis', () => {
    mount();
    for (const button of host.querySelectorAll('button')) {
      expect(button).toHaveAttribute('data-size', 'xs');
      expect(button).toHaveAttribute('data-tone', 'neutral');
      expect(button).toHaveAttribute('data-emphasis', 'medium');
      expect(button).toHaveAttribute('data-control-size', 'xs');
      expect(button).toHaveAccessibleDescription(model.labels.intro);
      expect(button).not.toHaveAttribute('data-full-width');
    }
  });

  it('renders no interactive controls while closed', () => {
    mount({ isOpen: false });
    expect(host.querySelector('aside')).toBeNull();
    expect(host.querySelector('[role="switch"]')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });
});
